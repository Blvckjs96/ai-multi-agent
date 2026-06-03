"""OllamaCodeSession — ArgoHarness local model coding agent.

Provides the same CLIEvent streaming interface as ClaudeCliSession so the
rest of the stack (chat_session.py, chat.py, frontend) needs zero changes.

ArgoHarness integration (all togglable via config):
  1. Skill Injector  — inject methodology skill into system prompt per category
  2. Model Tier Selector — pick right model (qwen:3b / gemma4:31b) for task
  3. Task Planner    — prepend structured plan preamble to user message
  4. Tool Executor   — execute Read/Write/Edit/Bash/Grep/Glob with guards
  5. Verification Gate — judge output quality; retry with feedback if low

Gemma4 specifics:
  - Native function calling confirmed (no text-based fallback needed)
  - Thinking mode enabled when HARNESS_GEMMA4_THINKING_ENABLED=true + effort=high
  - 262K context window — no context compression needed for typical tasks

Provider flexibility:
  Point OLLAMA_HOST to Argorouter to access 40+ providers transparently.
  User can override model via `user_model` param (validated against _KNOWN_MODELS).
"""

from __future__ import annotations

import json
import logging
import re as _re
import uuid
from collections.abc import AsyncIterator
from typing import Any

from app.argon.ai.agent_protocol import (
    AssistantTurn,
    ToolCall,
    assistant_message_from_turn,
    neutral_to_openai_messages,
    tool_results_message,
)
from app.core.config import settings
from app.services.claude_cli import CLIEvent, TriageResult
from app.services.task_planner import TaskPlan, build_plan_preamble, make_plan
from app.services.tool_executor import TOOL_SCHEMAS, ToolLoopGuard, execute_tool

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Session
# ---------------------------------------------------------------------------


class OllamaCodeSession:
    """Local model session.  Same CLIEvent interface as ClaudeCliSession."""

    def __init__(self) -> None:
        self.session_id: str | None = None
        self._client: Any = None  # openai.AsyncOpenAI, lazy init

    # ── public interface ────────────────────────────────────────────────────

    async def start(
        self,
        message: str,
        triage: TriageResult,
        *,
        permission_mode: str = "auto",
        session_id: str | None = None,
        system_prompt: str | None = None,
        cwd: str | None = None,
        user_model: str | None = None,
    ) -> AsyncIterator[CLIEvent]:
        """Spawn a local model session and yield CLIEvents.

        Args:
            message:      User message.
            triage:       Routing metadata — tools, model tier, effort.
            permission_mode: Ignored for local (always auto).
            session_id:   Resume hint — currently creates new UUID each time.
            system_prompt: Pre-built system prompt (persona + RAG + memory).
            cwd:          Working directory for tool execution.
            user_model:   Model selected by user in UI (validated before use).
        """
        self.session_id = session_id or str(uuid.uuid4())

        # ── system/init ──────────────────────────────────────────────────────
        yield CLIEvent(
            type="system",
            subtype="init",
            data={"session_id": self.session_id},
            session_id=self.session_id,
        )

        # ── ArgoHarness: skill injection ─────────────────────────────────────
        system_prompt = await self._inject_skill(message, triage, system_prompt)

        # ── ArgoHarness: model tier selection ────────────────────────────────
        context_chars = len(system_prompt) if system_prompt else 0
        tier = self._select_tier(triage, context_chars, user_model)
        model_id = tier.model_id

        logger.info(
            "OllamaCodeSession start session=%s model=%s tier=%d cwd=%s thinking=%s",
            self.session_id[:8], model_id, tier.tier, cwd or "(none)", tier.supports_thinking,
        )

        # ── build tool schemas ────────────────────────────────────────────────
        tools = [
            TOOL_SCHEMAS[t]
            for t in triage.allowed_tools
            if t in TOOL_SCHEMAS
        ]

        # ── ArgoHarness: plan preamble ────────────────────────────────────────
        try:
            plan: TaskPlan = await make_plan(message, triage)
            user_content = build_plan_preamble(message, plan)
        except Exception as exc:
            logger.warning("Planner failed (non-fatal): %s", exc)
            user_content = message

        # ── initial message history ───────────────────────────────────────────
        messages: list[dict[str, Any]] = [{"role": "user", "content": user_content}]
        guard = ToolLoopGuard(settings.LOCAL_MAX_TOOL_ITERATIONS)
        tool_names_used: list[str] = []
        text_chunks: list[str] = []

        try:
            for attempt in range(settings.HARNESS_MAX_RETRIES + 1):
                text_chunks.clear()
                tool_names_used.clear()

                # ── tool execution loop ───────────────────────────────────────
                loop_done = False
                while not loop_done:
                    try:
                        turn = await self._call_model(
                            messages, tools, system_prompt, model_id, tier
                        )
                    except Exception as exc:
                        logger.exception("Ollama API call failed: %s", exc)
                        yield CLIEvent(
                            type="error", subtype=None,
                            data={"message": f"Ollama error: {exc}"},
                            session_id=self.session_id,
                        )
                        return

                    # stream text
                    if turn.text:
                        text_chunks.append(turn.text)
                        yield CLIEvent(
                            type="assistant", subtype="text",
                            data={}, text=turn.text,
                            session_id=self.session_id,
                        )

                    # no tool calls → exit loop
                    if turn.finish_reason != "tool_use" or not turn.tool_calls:
                        loop_done = True
                        break

                    # execute tool calls
                    results: list[tuple[str, str, Any]] = []
                    loop_broken = False

                    for tc in turn.tool_calls:
                        if not guard.check(tc.name, tc.arguments):
                            yield CLIEvent(
                                type="assistant", subtype="text", data={},
                                text="\n[Loop guard: max iterations reached]",
                                session_id=self.session_id,
                            )
                            loop_broken = True
                            break

                        tool_index = len(results)
                        tool_names_used.append(tc.name)

                        yield CLIEvent(
                            type="tool_use", subtype=None,
                            data={"tool_use": {"name": tc.name, "input": tc.arguments},
                                  "index": tool_index},
                            session_id=self.session_id,
                        )

                        result_text = await execute_tool(tc.name, tc.arguments, cwd=cwd)

                        yield CLIEvent(
                            type="tool_result", subtype=None,
                            data={"tool_result": {"content": result_text},
                                  "index": tool_index},
                            session_id=self.session_id,
                        )
                        results.append((tc.id, tc.name, result_text))

                    if loop_broken:
                        loop_done = True
                        break

                    messages.append(assistant_message_from_turn(turn))
                    messages.append(tool_results_message(results))

                # ── ArgoHarness: verification gate ────────────────────────────
                final_text = "".join(text_chunks)
                vr = await self._verify(message, final_text, tool_names_used)

                if vr.accepted:
                    break  # output is good — exit retry loop

                if attempt < settings.HARNESS_MAX_RETRIES:
                    logger.info(
                        "verification_gate: score=%d < threshold — retry %d/%d",
                        vr.score, attempt + 1, settings.HARNESS_MAX_RETRIES,
                    )
                    # Inject feedback as a new user turn and retry
                    feedback_msg = (
                        f"[Quality check: your previous response scored {vr.score}/10. "
                        f"Issue: {vr.feedback or 'incomplete or incorrect'}. "
                        f"Please revise and improve your answer.]"
                    )
                    messages.append({"role": "user", "content": feedback_msg})
                    yield CLIEvent(
                        type="assistant", subtype="text", data={},
                        text=f"\n[Revising response (attempt {attempt + 2}/{settings.HARNESS_MAX_RETRIES + 1})…]\n",
                        session_id=self.session_id,
                    )

        except Exception as exc:
            logger.exception("OllamaCodeSession unexpected error: %s", exc)
            yield CLIEvent(
                type="error", subtype=None,
                data={"message": str(exc)},
                session_id=self.session_id,
            )
        finally:
            yield CLIEvent(
                type="result", subtype=None,
                data={"usage": {}, "cost_usd": 0.0},
                session_id=self.session_id,
            )

    async def terminate(self) -> None:
        """No-op — HTTP-based, no subprocess to kill."""

    # ── ArgoHarness helpers ──────────────────────────────────────────────────

    async def _inject_skill(
        self,
        message: str,
        triage: TriageResult,
        system_prompt: str | None,
    ) -> str | None:
        """Inject ArgoHarness methodology skill into system prompt."""
        try:
            from app.services.skill_injector import get_skill_content
            from app.services.task_planner import _infer_category
            category = _infer_category(triage) or "general_coding"
            skill = get_skill_content(category, triage)
            if skill:
                return (system_prompt + "\n\n" + skill) if system_prompt else skill
        except Exception as exc:
            logger.debug("skill_injector failed (non-fatal): %s", exc)
        return system_prompt

    def _select_tier(
        self,
        triage: TriageResult,
        context_chars: int,
        user_model: str | None,
    ):
        """Select model tier via ModelTierSelector."""
        try:
            from app.services.model_tier_selector import select_model_tier
            return select_model_tier(triage, context_chars=context_chars, user_override=user_model)
        except Exception as exc:
            logger.warning("model_tier_selector failed (non-fatal): %s", exc)
            # Safe fallback dataclass-like object
            from types import SimpleNamespace
            return SimpleNamespace(
                model_id=settings.OLLAMA_TIER1_MODEL,
                tier=1,
                context_window=32_768,
                supports_thinking=False,
            )

    async def _verify(self, task: str, output: str, tool_names: list[str]):
        """Run verification gate. Always returns a result — never raises."""
        try:
            from app.services.verification_gate import verify_output
            return await verify_output(
                task, output, had_tool_calls=bool(tool_names)
            )
        except Exception as exc:
            logger.debug("verification_gate failed (non-fatal): %s", exc)
            from app.services.verification_gate import VerificationResult
            return VerificationResult(score=10, feedback="", accepted=True, skipped=True)

    # ── internal helpers ─────────────────────────────────────────────────────

    def _get_client(self) -> Any:
        if self._client is None:
            import openai
            self._client = openai.AsyncOpenAI(
                base_url=f"{settings.OLLAMA_HOST.rstrip('/')}/v1",
                api_key="ollama",
                timeout=120.0,
            )
        return self._client

    async def _call_model(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        system: str | None,
        model_id: str,
        tier: Any,
    ) -> AssistantTurn:
        """Call Ollama via OpenAI-compatible API and return a neutral AssistantTurn."""
        client = self._get_client()

        openai_messages: list[dict[str, Any]] = []
        if system:
            openai_messages.append({"role": "system", "content": system})
        openai_messages.extend(neutral_to_openai_messages(messages))

        kwargs: dict[str, Any] = {
            "model": model_id,
            "messages": openai_messages,
            "temperature": 0.2,
        }
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"

        # Gemma4 thinking mode for complex tasks.
        # Passed via extra_body since the OpenAI SDK doesn't accept non-standard params.
        is_gemma4 = "gemma4" in model_id
        if is_gemma4 and settings.HARNESS_GEMMA4_THINKING_ENABLED and getattr(tier, "supports_thinking", False):
            kwargs["extra_body"] = {"thinking": {"type": "enabled", "budget_tokens": 2048}}

        response = await client.chat.completions.create(**kwargs)
        choice = response.choices[0]
        msg = choice.message

        text = msg.content or None
        tool_calls: list[ToolCall] = []

        if msg.tool_calls:
            for tc in msg.tool_calls:
                args: dict[str, Any] = {}
                if tc.function.arguments:
                    try:
                        args = json.loads(tc.function.arguments)
                    except json.JSONDecodeError:
                        args = {"_raw": tc.function.arguments}
                tool_calls.append(ToolCall(
                    id=tc.id or str(uuid.uuid4()),
                    name=tc.function.name,
                    arguments=args,
                ))

        # Fallback text-based parser for non-native-tool-calling models
        # Gemma4 confirmed native → skip; smaller models may still need it
        if not tool_calls and text and not is_gemma4:
            parsed = _extract_text_tool_calls(text)
            if parsed:
                tool_calls = parsed
                text = None

        reason_map = {"stop": "end_turn", "tool_calls": "tool_use", "length": "max_tokens"}
        finish_reason = reason_map.get(choice.finish_reason or "stop", "end_turn")

        if tool_calls and finish_reason == "end_turn":
            finish_reason = "tool_use"

        return AssistantTurn(text=text, tool_calls=tool_calls, finish_reason=finish_reason)


# ---------------------------------------------------------------------------
# Text-based tool call parser (fallback for smaller models)
# ---------------------------------------------------------------------------

_FENCED_RE = _re.compile(r"```(?:json)?\s*([\s\S]*?)\s*```")
_TOOL_NAME_KEYS = ("name", "tool", "function", "tool_name")
_TOOL_ARGS_KEYS = ("arguments", "args", "parameters", "params", "input")


def _extract_text_tool_calls(text: str) -> list[ToolCall]:
    """Parse tool calls embedded as JSON in model text output."""
    from app.services.tool_executor import normalize_tool_name

    candidates: list[str] = []
    for m in _FENCED_RE.finditer(text):
        candidates.append(m.group(1).strip())
    candidates.append(text.strip())
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("{") and line.endswith("}"):
            candidates.append(line)

    calls: list[ToolCall] = []
    seen: set[str] = set()
    for raw in candidates:
        if raw in seen:
            continue
        seen.add(raw)
        try:
            obj = json.loads(raw)
        except (json.JSONDecodeError, ValueError):
            continue
        if not isinstance(obj, dict):
            continue

        tool_name: str | None = None
        for key in _TOOL_NAME_KEYS:
            if key in obj and isinstance(obj[key], str):
                tool_name = obj[key]
                break
        if not tool_name:
            continue
        canonical = normalize_tool_name(tool_name)
        if not canonical:
            continue

        args: dict[str, Any] = {}
        for key in _TOOL_ARGS_KEYS:
            if key in obj and isinstance(obj[key], dict):
                args = obj[key]
                break

        calls.append(ToolCall(id=str(uuid.uuid4()), name=canonical, arguments=args))

    return calls
