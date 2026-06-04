import { useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import Drawer from '../ui/Drawer'
import { API_ORIGIN } from '../../lib/api'

function authHeaders() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function NoteEditor({ note, onTitleChange, onContentChange }) {
  const [drawerOpen, setDrawerOpen]  = useState(false)
  const [aiPrompt, setAiPrompt]      = useState('')
  const [aiMessages, setAiMessages]  = useState([])
  const [aiStreaming, setAiStreaming] = useState(false)
  const contentRef  = useRef(null)
  const aiScrollRef = useRef(null)

  // Auto-scroll AI chat to bottom on new messages
  useEffect(() => {
    if (aiScrollRef.current) {
      aiScrollRef.current.scrollTop = aiScrollRef.current.scrollHeight
    }
  }, [aiMessages])

  const sendAiMessage = async () => {
    const prompt = aiPrompt.trim()
    if (!prompt || aiStreaming) return
    setAiPrompt('')

    const selectedText = window.getSelection()?.toString() || ''
    const context = selectedText
      ? `Context from note:\n\`\`\`\n${selectedText}\n\`\`\`\n\n${prompt}`
      : prompt

    setAiMessages((prev) => [...prev, { role: 'user', content: prompt }])
    setAiStreaming(true)

    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ message: context }),
      })
      if (!res.ok || !res.body) throw new Error('Stream failed')

      setAiMessages((prev) => [...prev, { role: 'assistant', content: '' }])
      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer    = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          const data = line.slice(5).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            const delta  = parsed?.delta ?? parsed?.text ?? parsed?.content ?? ''
            if (delta) {
              setAiMessages((prev) => {
                const msgs = [...prev]
                const last = msgs[msgs.length - 1]
                if (last?.role === 'assistant') {
                  msgs[msgs.length - 1] = { ...last, content: last.content + delta }
                }
                return msgs
              })
            }
          } catch { /* skip malformed SSE lines */ }
        }
      }
    } catch (e) {
      setAiMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${e.message}` }])
    } finally {
      setAiStreaming(false)
    }
  }

  if (!note) {
    return (
      <div className="flex-1 flex items-center justify-center text-argo-muted">
        <p className="text-sm">Select a note or create a new one.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-2.5 border-b border-argo-border flex-shrink-0">
        <div className="flex items-center gap-2 text-xs text-argo-muted">
          {note.updated_at && (
            <span>
              Saved {new Date(note.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-argo-cyan border border-argo-cyan/30 hover:bg-argo-cyan/10 transition-colors"
        >
          <Sparkles size={12} />
          AI Assist
        </button>
      </div>

      {/* Title */}
      <input
        value={note.title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Note title…"
        className="px-6 pt-5 pb-2 text-xl font-bold text-argo-primary bg-transparent outline-none border-none w-full placeholder:text-argo-muted/40"
      />

      {/* Content */}
      <textarea
        ref={contentRef}
        value={note.content}
        onChange={(e) => onContentChange(e.target.value)}
        placeholder="Start writing…"
        className="flex-1 px-6 py-2 text-sm text-argo-secondary bg-transparent outline-none resize-none leading-relaxed font-mono"
      />

      {/* AI Assist drawer */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="AI Assist" side="right" width="380px">
        <div className="flex flex-col h-full">
          <div ref={aiScrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {aiMessages.length === 0 && (
              <p className="text-xs text-argo-muted text-center pt-8">
                Ask anything about this note.<br />
                Select text first for context-aware help.
              </p>
            )}
            {aiMessages.map((msg, i) => (
              <div
                key={i}
                className={`text-sm rounded-lg px-3 py-2 ${
                  msg.role === 'user'
                    ? 'bg-argo-cyan/10 text-argo-primary self-end max-w-[85%]'
                    : 'bg-argo-elevated text-argo-secondary self-start max-w-[95%]'
                }`}
              >
                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed">{msg.content}</pre>
              </div>
            ))}
            {aiStreaming &&
              aiMessages[aiMessages.length - 1]?.role === 'assistant' &&
              aiMessages[aiMessages.length - 1]?.content === '' && (
                <div className="text-xs text-argo-muted animate-pulse">Thinking…</div>
              )}
          </div>
          <div className="p-3 border-t border-argo-border flex gap-2">
            <input
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendAiMessage()
                }
              }}
              placeholder="Ask AI…"
              className="flex-1 bg-argo-elevated border border-argo-border rounded-lg px-3 py-2 text-xs text-argo-primary outline-none focus:border-argo-cyan transition-colors"
            />
            <button
              type="button"
              onClick={sendAiMessage}
              disabled={!aiPrompt.trim() || aiStreaming}
              className="px-3 py-2 rounded-lg text-xs font-bold bg-argo-cyan text-[#001218] disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              Send
            </button>
          </div>
        </div>
      </Drawer>
    </div>
  )
}
