// All NIM models are confirmed free-endpoint (nim_type_preview) at build.nvidia.com
const ROLE_CHAINS = {
  planner: [
    { provider: 'nim', model: 'stepfun-ai/step-3.5-flash', note: '200B reasoning + agentic' },
    { provider: 'nim', model: 'minimax/minimax-m2.7', note: '230B MoE fallback' },
    { provider: 'nim', model: 'bytedance/seed-oss-36b-instruct', note: '36B long-context' },
    { provider: 'ollama', model: 'gemma4 (local)', note: 'Local last resort' },
  ],
  engineer: [
    { provider: 'nim', model: 'qwen/qwen3-coder-480b-a35b-instruct', note: '480B agentic coding' },
    { provider: 'nim', model: 'abacus-ai/dracarys-llama-3.1-70b-instruct', note: '70B code fine-tune' },
    { provider: 'nim', model: 'mistralai/mistral-nemotron', note: 'Agentic + function calling' },
    { provider: 'ollama', model: 'gemma4 (local)', note: 'Local last resort' },
  ],
  cost_estimator: [
    { provider: 'nim', model: 'mistralai/mistral-nemotron', note: 'Instruction following' },
    { provider: 'nim', model: 'stepfun-ai/step-3.5-flash', note: '200B reasoning fallback' },
    { provider: 'nim', model: 'meta/llama-4-maverick-17b-128e-instruct', note: '17B MoE, fast' },
    { provider: 'ollama', model: 'gemma4 (local)', note: 'Local last resort' },
  ],
  writer: [
    { provider: 'nim', model: 'mistralai/mistral-large-3-675b-instruct-2512', note: '675B language gen' },
    { provider: 'nim', model: 'minimax/minimax-m2.7', note: '230B office + writing' },
    { provider: 'nim', model: 'bytedance/seed-oss-36b-instruct', note: '36B long-context' },
    { provider: 'ollama', model: 'gemma4 (local)', note: 'Local last resort' },
  ],
}

const PROVIDER_COLORS = {
  nim: '#76b900',
  ollama: '#6366f1',
  anthropic: '#cc785c',
  claude_cli: '#cc785c',
}

function ChainStep({ step, index, total }) {
  const color = PROVIDER_COLORS[step.provider] || 'var(--accent-cyan)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: index === 0 ? color : 'var(--bg-overlay)',
          border: `1px solid ${index === 0 ? color : 'var(--border)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '10px',
          fontFamily: 'var(--f-mono)',
          color: index === 0 ? '#000' : 'var(--text-muted)',
          flexShrink: 0,
          fontWeight: 700,
        }}
      >
        {index + 1}
      </span>

      <span
        style={{
          fontSize: '10px',
          fontFamily: 'var(--f-mono)',
          color,
          background: `${color}12`,
          border: `1px solid ${color}30`,
          borderRadius: 4,
          padding: '2px 6px',
          flexShrink: 0,
        }}
      >
        {step.provider}
      </span>

      <span
        style={{
          fontFamily: 'var(--f-mono)',
          fontSize: '11px',
          color: index === 0 ? 'var(--text-primary)' : 'var(--text-muted)',
          flex: 1,
        }}
      >
        {step.model}
      </span>

      <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
        {step.note}
      </span>

      {index < total - 1 && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>→</span>}
    </div>
  )
}

export default function FallbackChainEditor() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{
          fontSize: '11px',
          color: 'var(--text-muted)',
          fontFamily: 'var(--f-mono)',
          background: 'rgba(0,212,255,0.06)',
          border: '1px solid rgba(0,212,255,0.15)',
          borderRadius: 'var(--r-sm)',
          padding: '8px 12px',
        }}
      >
        Fallback chains are read-only. Edit role assignments via{' '}
        <code style={{ color: 'var(--text-code)' }}>NIM_FAST_MODEL</code> /{' '}
        <code style={{ color: 'var(--text-code)' }}>NIM_REASONING_MODEL</code> in{' '}
        <code style={{ color: 'var(--text-code)' }}>.env</code>.
      </div>

      {Object.entries(ROLE_CHAINS).map(([role, chain]) => (
        <div
          key={role}
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '10px 14px 8px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontFamily: 'var(--f-mono)',
                fontWeight: 700,
                color: 'var(--accent-cyan)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {role}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>agent role</span>
          </div>
          <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {chain.map((step, i) => (
              <ChainStep key={i} step={step} index={i} total={chain.length} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
