import { useCallback, useRef } from 'react'
import { SendHorizonal, Paperclip } from 'lucide-react'

export function ChatInput({ onSend, disabled, placeholder = 'Ask Argo anything…', onFileSelect }) {
  const ref = useRef(null)
  const fileInputRef = useRef(null)

  const submit = useCallback(() => {
    const val = ref.current?.value?.trim()
    if (!val || disabled) return
    onSend(val)
    ref.current.value = ''
    ref.current.style.height = 'auto'
  }, [onSend, disabled])

  const onKey = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        submit()
      }
    },
    [submit],
  )

  const onInput = useCallback((e) => {
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 180) + 'px'
  }, [])

  const handleFileClick = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }, [disabled])

  const handleFileChange = useCallback(
    (e) => {
      if (onFileSelect && e.target.files?.length > 0) {
        onFileSelect(e.target.files)
      }
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [onFileSelect],
  )

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '10px',
        padding: '12px 16px',
        borderTop: '1px solid var(--border)',
        background: 'rgba(13,13,13,0.8)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <button
        onClick={handleFileClick}
        disabled={disabled}
        aria-label="Attach file"
        style={{
          width: 36,
          height: 36,
          borderRadius: 'var(--r-sm, 6px)',
          border: 'none',
          background: 'transparent',
          color: disabled ? 'var(--text-muted)' : 'var(--text-muted)',
          cursor: disabled ? 'default' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'color 150ms',
        }}
        onMouseEnter={(e) => {
          if (!disabled) e.target.style.color = 'var(--text-secondary)'
        }}
        onMouseLeave={(e) => {
          e.target.style.color = 'var(--text-muted)'
        }}
      >
        <Paperclip size={20} />
      </button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <textarea
        ref={ref}
        rows={1}
        onKeyDown={onKey}
        onInput={onInput}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          flex: 1,
          resize: 'none',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-strong)',
          borderRadius: '12px',
          padding: '10px 14px',
          fontSize: '14px',
          color: 'var(--text-primary)',
          lineHeight: 1.5,
          outline: 'none',
          overflowY: 'hidden',
          transition: 'border-color 150ms',
          fontFamily: 'inherit',
        }}
        onFocus={(e) => (e.target.style.borderColor = '#00d4ff55')}
        onBlur={(e) => (e.target.style.borderColor = 'var(--border-strong)')}
      />
      <button
        onClick={submit}
        disabled={disabled}
        aria-label="Send"
        style={{
          width: 38,
          height: 38,
          borderRadius: '50%',
          border: 'none',
          background: disabled
            ? 'var(--border)'
            : 'linear-gradient(135deg, #00d4ff, #00ff9d)',
          color: '#0a0a0a',
          cursor: disabled ? 'default' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'opacity 150ms',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <SendHorizonal size={16} />
      </button>
    </div>
  )
}
