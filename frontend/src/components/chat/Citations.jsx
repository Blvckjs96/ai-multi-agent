import { useState } from 'react'
import { BookOpen, Globe, X } from 'lucide-react'

function CitationModal({ sources, webSources, onClose }) {
  const [activeTab, setActiveTab] = useState(webSources?.length ? 'web' : 'kb')
  const [activeIdx, setActiveIdx] = useState(0)

  const kbSources = sources || []
  const wSources = webSources || []

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: '12px',
          width: '520px',
          maxWidth: '90vw',
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Sources
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Tabs */}
        {kbSources.length > 0 && wSources.length > 0 && (
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 18px' }}>
            {[
              { key: 'kb', label: 'Knowledge', icon: BookOpen },
              { key: 'web', label: 'Web', icon: Globe },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => { setActiveTab(key); setActiveIdx(0) }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: activeTab === key ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                  color: activeTab === key ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  marginBottom: '-1px',
                  transition: 'color 150ms',
                }}
              >
                <Icon size={11} />
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
          {activeTab === 'kb' && kbSources.length > 0 && (
            <>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
                {kbSources.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveIdx(i)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 500,
                      border: '1px solid',
                      borderColor: i === activeIdx ? 'var(--accent-cyan)' : 'var(--border)',
                      background: i === activeIdx ? 'rgba(0,212,255,0.08)' : 'transparent',
                      color: i === activeIdx ? 'var(--accent-cyan)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      transition: 'all 150ms',
                    }}
                  >
                    [{i + 1}] {s.name}
                  </button>
                ))}
              </div>
              {kbSources[activeIdx] && (
                <div
                  style={{
                    background: 'var(--bg-elevated)',
                    borderRadius: '8px',
                    padding: '14px',
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.7,
                    fontFamily: 'var(--f-mono)',
                    whiteSpace: 'pre-wrap',
                    border: '1px solid var(--border)',
                  }}
                >
                  {kbSources[activeIdx].chunk}
                </div>
              )}
            </>
          )}

          {activeTab === 'web' && wSources.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {wSources.map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    padding: '12px 14px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    transition: 'border-color 150ms',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--border-strong)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--accent-cyan)', marginBottom: '4px' }}>
                    {s.title || s.url}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontFamily: 'monospace' }}>
                    {s.url}
                  </div>
                  {s.snippet && (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {s.snippet}
                    </div>
                  )}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Citations({ sources, webSources }) {
  const [open, setOpen] = useState(false)

  const kbCount = sources?.length ?? 0
  const webCount = webSources?.length ?? 0
  const total = kbCount + webCount

  if (!total) return null

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '8px' }}>
        {sources?.map((s, i) => (
          <button
            key={`kb-${i}`}
            type="button"
            onClick={() => setOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '9999px',
              fontSize: '10px',
              fontWeight: 500,
              border: '1px solid rgba(0,212,255,0.25)',
              background: 'rgba(0,212,255,0.06)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 150ms',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(0,212,255,0.5)'
              e.currentTarget.style.color = 'var(--accent-cyan)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(0,212,255,0.25)'
              e.currentTarget.style.color = 'var(--text-muted)'
            }}
          >
            <BookOpen size={9} />
            <span>{s.name}</span>
            <span style={{ opacity: 0.5 }}>[{i + 1}]</span>
          </button>
        ))}
        {webSources?.map((s, i) => (
          <button
            key={`web-${i}`}
            type="button"
            onClick={() => setOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '9999px',
              fontSize: '10px',
              fontWeight: 500,
              border: '1px solid rgba(0,255,157,0.2)',
              background: 'rgba(0,255,157,0.04)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 150ms',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(0,255,157,0.4)'
              e.currentTarget.style.color = 'var(--accent-green)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(0,255,157,0.2)'
              e.currentTarget.style.color = 'var(--text-muted)'
            }}
          >
            <Globe size={9} />
            <span>{s.title?.slice(0, 30) || 'Web result'}</span>
          </button>
        ))}
      </div>

      {open && (
        <CitationModal
          sources={sources}
          webSources={webSources}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
