"""ArgoHarness Verification Gate.

Scores the quality of a local model's output before returning it to the user.
Uses the smallest available model (HARNESS_JUDGE_MODEL, default qwen2.5:0.5b)
as a fast, cheap judge to avoid showing low-quality responses.

Trigger conditions (all must be true to activate scoring):
  1. HARNESS_VERIFICATION_ENABLED is True
  2. Output is longer than MIN_OUTPUT_CHARS (skip trivial responses)
  3. Session used at least one tool call (complex execution path)

Score 0-10:
  ≥ HARNESS_VERIFICATION_THRESHOLD (default 7) → accepted, returned to user
  < threshold → feedback injected, caller may retry

The gate is entirely non-fatal: any exception returns accepted=True so the
agent loop is never blocked by judge failures.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass

from app.core.config import settings

logger = logging.getLogger(__name__)

# Outputs shorter than this are not scored (greetings, one-liners are fine).
_MIN_OUTPUT_CHARS = 120


# ---------------------------------------------------------------------------
# Result type
# ---------------------------------------------------------------------------

@dataclass
class VerificationResult:
    score: int       # 0-10
    feedback: str    # issue description when score < threshold
    accepted: bool   # True when score >= HARNESS_VERIFICATION_THRESHOLD
    skipped: bool    # True when gate was bypassed (toggle off, short output, etc.)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def verify_output(
    task: str,
    output: str,
    *,
    had_tool_calls: bool = False,
) -> VerificationResult:
    """Score output quality. Non-blocking — always returns a result.

    Args:
        task:           The original user message / task description.
        output:         The full text output produced by the model.
        had_tool_calls: Whether the session executed any tool calls.
                        Scoring is only triggered for tool-using sessions.
    """
    # Skip when globally disabled
    if not settings.HARNESS_VERIFICATION_ENABLED:
        return VerificationResult(score=10, feedback="", accepted=True, skipped=True)

    # Skip for short or tool-free outputs — they're either trivial or fine
    if len(output) < _MIN_OUTPUT_CHARS or not had_tool_calls:
        return VerificationResult(score=10, feedback="", accepted=True, skipped=True)

    try:
        score, feedback = await _call_judge(task, output)
        threshold = settings.HARNESS_VERIFICATION_THRESHOLD
        accepted = score >= threshold
        logger.info(
            "verification_gate: score=%d/%d feedback=%r accepted=%s",
            score, threshold, feedback[:80] if feedback else "", accepted,
        )
        return VerificationResult(score=score, feedback=feedback, accepted=accepted, skipped=False)
    except Exception as exc:
        logger.warning("verification_gate: judge failed (non-fatal): %s", exc)
        return VerificationResult(score=10, feedback="", accepted=True, skipped=True)


# ---------------------------------------------------------------------------
# Judge implementation
# ---------------------------------------------------------------------------

async def _call_judge(task: str, output: str) -> tuple[int, str]:
    """Ask the judge model to score the output. Returns (score, feedback)."""
    import openai

    client = openai.AsyncOpenAI(
        base_url=f"{settings.OLLAMA_HOST.rstrip('/')}/v1",
        api_key="ollama",
        timeout=20.0,
    )

    prompt = (
        f"Task: {task[:400]}\n\n"
        f"Output:\n{output[:800]}\n\n"
        f"Evaluate: does this output correctly and completely address the task?\n"
        f"Reply with JSON only (no other text):\n"
        f'  {{"score": <integer 0-10>, "issue": "<one sentence or empty string>"}}'
    )

    resp = await client.chat.completions.create(
        model=settings.HARNESS_JUDGE_MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=100,
        temperature=0.0,
    )
    raw = (resp.choices[0].message.content or "").strip()
    return _parse_judge_response(raw)


def _parse_judge_response(raw: str) -> tuple[int, str]:
    """Parse judge response. Returns safe defaults on parse failure."""
    # Try direct JSON parse
    try:
        d = json.loads(raw)
        score = max(0, min(10, int(d.get("score", 7))))
        feedback = str(d.get("issue", "")).strip()
        return score, feedback
    except (json.JSONDecodeError, ValueError, TypeError):
        pass

    # Try to extract JSON from within text (model may add extra words)
    import re
    m = re.search(r'\{[^{}]+\}', raw)
    if m:
        try:
            d = json.loads(m.group())
            score = max(0, min(10, int(d.get("score", 7))))
            feedback = str(d.get("issue", "")).strip()
            return score, feedback
        except Exception:
            pass

    # Try to extract just a number
    m2 = re.search(r'\b([0-9]|10)\b', raw)
    if m2:
        return int(m2.group()), "Could not parse detailed feedback"

    # Safe fallback — accept the output
    logger.debug("verification_gate: unparseable judge response: %r", raw[:100])
    return 7, ""
