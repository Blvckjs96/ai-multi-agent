import { useCallback, useRef, useState } from 'react'
import { SendHorizonal, Paperclip, Globe, Mic } from 'lucide-react'
import Tooltip from '../ui/Tooltip'

export function ChatInput({
  onSend,
  disabled,
  placeholder = 'Ask Argo anything…',
  onFileSelect,
  onWebSearchToggle,
  webSearch = false,
  onHashTrigger,
}) {
  const ref = useRef(null)
  const fileInputRef = useRef(null)
  const [clipHovered, setClipHovered] = useState(false)

  const submit = useCallback(() => {
    const val = ref.current?.value?.trim()
    if (!val || disabled) return
    onSend(val)
    ref.current.value = ''
    ref.current.style.height = 'auto'
  }, [onSend, disabled])

  const onKey = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }, [submit])

  const onInput = useCallback((e) => {
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 180) + 'px'
    // Trigger # knowledge picker when value ends with #
    if (onHashTrigger) {
      const val = e.target.value
      onHashTrigger(val.endsWith('#'))
    }
  }, [onHashTrigger])

  const handleFileClick = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }, [disabled])

  const handleFileChange = useCallback((e) => {
    if (onFileSelect && e.target.files?.length > 0) {
      onFileSelect(e.target.files)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [onFileSelect])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0 && onFileSelect) onFileSelect(files)
  }, [onFileSelect])

  const iconBtnBase = {
    width: 32,
    height: 32,
    borderRadius: '6px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'color 120ms ease-out',
  }

  const paperclipBtnStyle = {
    ...iconBtnBase,
    color: disabled ? 'var(--text-muted)' : clipHovered ? 'var(--text-secondary)' : 'var(--text-muted)',
    opacity: disabled ? 0.4 : 1,
  }

  const globeBtnStyle = {
    ...iconBtnBase,
    color: webSearch ? 'var(--accent-cyan)' : 'var(--text-muted)',
    background: webSearch ? 'rgba(0,212,255,0.08)' : 'transparent',
    border: webSearch ? '1px solid rgba(0,212,255,0.2)' : '1px solid transparent',
  }

  const micBtnStyle = {
    ...iconBtnBase,
    color: 'var(--text-muted)',
    opacity: 0.35,
    cursor: 'not-allowed',
  }

  const sendBtnStyle = {
    width: 38,
    height: 38,
    borderRadius: '50%',
    border: 'none',
    background: disabled ? 'var(--border)' : 'linear-gradient(135deg, #00d4ff, #00ff9d)',
    color: '#0a0a0a',
    cursor: disabled ? 'default' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'opacity 150ms',
    opacity: disabled ? 0.5 : 1,
  }

  const textareaStyle = {
    flex: 1,
    resize: 'none',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-strong)',
    borderRadius: '12px',
    padding: '10px 14px',
    fontSize: '14px',
    color: 'var(--text-primary)',
    lineHeight: 1.5,
    overflowY: 'hidden',
    transition: 'border-color 150ms',
    fontFamily: 'inherit',
  }

  const containerStyle = {
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-end',
    gap: '8px',
    padding: '12px 16px',
    borderTop: '1px solid var(--border)',
    background: 'rgba(13,13,13,0.8)',
    backdropFilter: 'blur(12px)',
  }

  return (
    <div
      style={containerStyle}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <button
        type="button"
        onClick={handleFileClick}
        disabled={disabled}
        aria-label="Attach file"
        style={paperclipBtnStyle}
        onMouseEnter={() => setClipHovered(true)}
        onMouseLeave={() => setClipHovered(false)}
      >
        <Paperclip size={18} />
      </button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      <Tooltip content={webSearch ? 'Web search on' : 'Web search off'} side="top">
        <button
          type="button"
          onClick={() => onWebSearchToggle?.(!webSearch)}
          aria-label={webSearch ? 'Disable web search' : 'Enable web search'}
          style={globeBtnStyle}
        >
          <Globe size={16} />
        </button>
      </Tooltip>

      <Tooltip content="Voice input — coming in Phase 4" side="top">
        <button
          type="button"
          disabled
          aria-label="Voice input (coming soon)"
          style={micBtnStyle}
        >
          <Mic size={16} />
        </button>
      </Tooltip>

      <textarea
        ref={ref}
        rows={1}
        onKeyDown={onKey}
        onInput={onInput}
        placeholder={placeholder}
        disabled={disabled}
        style={textareaStyle}
        onFocus={(e) => (e.target.style.borderColor = 'var(--border-accent)')}
        onBlur={(e) => (e.target.style.borderColor = 'var(--border-strong)')}
      />

      <button type="button" onClick={submit} disabled={disabled} aria-label="Send" style={sendBtnStyle}>
        <SendHorizonal size={16} />
      </button>
    </div>
  )
}
