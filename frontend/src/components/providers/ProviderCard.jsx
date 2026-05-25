import ModelHealthRow from './ModelHealthRow'

const PROVIDER_META = {
  claude_cli: { label: 'Claude Code CLI', color: '#cc785c', desc: 'Pro/Max subscription • Local' },
  ollama: { label: 'Ollama', color: '#6366f1', desc: 'Local inference • No API key' },
  anthropic: { label: 'Anthropic API', color: '#cc785c', desc: 'Pay-per-token • Cloud' },
  nim: { label: 'NVIDIA NIM', color: '#76b900', desc: 'Free tier • Cloud • Rate-limited' },
}

function getProviderModels(providerId, modelLocks) {
  return Object.entries(modelLocks || {}).filter(([key]) => key.startsWith(providerId + '/'))
}

export default function ProviderCard({ providerId, providerData, modelLocks }) {
  const meta = PROVIDER_META[providerId] || {
    label: providerId,
    color: 'var(--accent-cyan)',
    desc: '',
  }
  const available = providerData?.available ?? false
  const models = getProviderModels(providerId, modelLocks)

  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 16px',
          borderBottom: models.length > 0 ? '1px solid var(--border)' : 'none',
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 3,
            background: available ? meta.color : 'var(--text-muted)',
            flexShrink: 0,
          }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontFamily: 'var(--f-ui)',
                fontWeight: 600,
                fontSize: '13px',
                color: 'var(--text-primary)',
              }}
            >
              {meta.label}
            </span>
            <span
              style={{
                fontSize: '10px',
                fontFamily: 'var(--f-mono)',
                color: available ? 'var(--status-success)' : 'var(--text-muted)',
                background: available ? 'rgba(0,255,157,0.08)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${available ? 'rgba(0,255,157,0.2)' : 'var(--border)'}`,
                borderRadius: 4,
                padding: '1px 6px',
              }}
            >
              {available ? 'Online' : 'Offline'}
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2 }}>
            {meta.desc}
          </div>
        </div>

        {providerId === 'ollama' && providerData?.model && (
          <span
            style={{
              fontFamily: 'var(--f-mono)',
              fontSize: '11px',
              color: 'var(--text-muted)',
              background: 'var(--bg-overlay)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)',
              padding: '3px 8px',
            }}
          >
            {providerData.model}
          </span>
        )}
        {providerId === 'nim' && !providerData?.enabled && (
          <span
            style={{
              fontFamily: 'var(--f-mono)',
              fontSize: '10px',
              color: 'var(--text-muted)',
            }}
          >
            NIM_ENABLED=false
          </span>
        )}
      </div>

      {models.length > 0 && (
        <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {models.map(([key, health]) => (
            <ModelHealthRow key={key} modelKey={key} health={health} />
          ))}
        </div>
      )}

      {providerId === 'nim' && models.length === 0 && available && (
        <div style={{ padding: '10px 16px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            No models have been called yet
          </span>
        </div>
      )}
    </div>
  )
}
