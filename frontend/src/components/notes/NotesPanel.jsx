import { useState } from 'react'
import { Pin, Plus, Search } from 'lucide-react'
import { useNotes } from '../../hooks/useNotes'
import NoteEditor from './NoteEditor'

function NoteItem({ note, active, onSelect, onPin }) {
  const preview = note.content?.split('\n').find((l) => l.trim()) ?? ''
  return (
    <button
      type="button"
      onClick={() => onSelect(note.id)}
      className={`w-full px-3 py-2.5 text-left transition-colors border-l-2 ${
        active
          ? 'border-argo-cyan bg-cyan-500/10'
          : 'border-transparent hover:bg-argo-elevated'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-argo-primary truncate flex-1">
          {note.title || 'Untitled'}
        </span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPin(note.id) }}
          aria-label={note.pinned ? 'Unpin' : 'Pin'}
          className={`flex-shrink-0 mt-0.5 transition-colors ${
            note.pinned ? 'text-argo-cyan' : 'text-argo-muted hover:text-argo-secondary'
          }`}
        >
          <Pin size={11} />
        </button>
      </div>
      {preview && (
        <p className="text-[10px] text-argo-muted truncate mt-0.5 leading-relaxed">{preview}</p>
      )}
    </button>
  )
}

function SectionLabel({ children }) {
  return (
    <div className="px-3 py-1.5">
      <span className="text-[9px] font-bold uppercase tracking-wider text-argo-muted">{children}</span>
    </div>
  )
}

export default function NotesPanel({ workspaceId }) {
  const {
    notes: sorted,
    pinned,
    regular,
    active,
    activeId,
    setActiveId,
    loading,
    createNote,
    debouncedUpdate,
    togglePin,
  } = useNotes(workspaceId)

  const [search, setSearch] = useState('')

  const filtered = search.trim()
    ? sorted.filter(
        (n) =>
          n.title.toLowerCase().includes(search.toLowerCase()) ||
          n.content.toLowerCase().includes(search.toLowerCase()),
      )
    : sorted

  const filteredPinned  = filtered.filter((n) => n.pinned)
  const filteredRegular = filtered.filter((n) => !n.pinned)

  const handleNew = async () => {
    await createNote()
  }

  const handleTitleChange = (val) => {
    if (!active) return
    debouncedUpdate(active.id, { title: val })
  }

  const handleContentChange = (val) => {
    if (!active) return
    debouncedUpdate(active.id, { content: val })
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: note list (240px) */}
      <div className="w-60 flex-shrink-0 border-r border-argo-border flex flex-col overflow-hidden bg-argo-surface">
        {/* Search + new button */}
        <div className="p-3 border-b border-argo-border flex flex-col gap-2">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-argo-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes…"
              className="w-full bg-argo-elevated border border-argo-border rounded-lg pl-7 pr-3 py-1.5 text-xs text-argo-primary outline-none focus:border-argo-cyan transition-colors"
            />
          </div>
          <button
            type="button"
            onClick={handleNew}
            className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg text-xs font-semibold bg-argo-cyan text-[#001218] hover:opacity-90 transition-opacity"
          >
            <Plus size={12} />
            New note
          </button>
        </div>

        {/* Note list */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <p className="text-[10px] text-argo-muted text-center pt-6">Loading…</p>
          )}
          {!loading && sorted.length === 0 && (
            <p className="text-xs text-argo-muted text-center pt-8 px-4">
              No notes yet.<br />
              Click <strong className="text-argo-secondary">New note</strong> to start.
            </p>
          )}
          {filteredPinned.length > 0 && (
            <>
              <SectionLabel>Pinned</SectionLabel>
              {filteredPinned.map((n) => (
                <NoteItem
                  key={n.id}
                  note={n}
                  active={n.id === activeId}
                  onSelect={setActiveId}
                  onPin={togglePin}
                />
              ))}
            </>
          )}
          {filteredRegular.length > 0 && (
            <>
              {filteredPinned.length > 0 && <SectionLabel>Notes</SectionLabel>}
              {filteredRegular.map((n) => (
                <NoteItem
                  key={n.id}
                  note={n}
                  active={n.id === activeId}
                  onSelect={setActiveId}
                  onPin={togglePin}
                />
              ))}
            </>
          )}
          {filtered.length === 0 && search && (
            <p className="text-xs text-argo-muted text-center pt-6 px-4">
              No notes match &ldquo;{search}&rdquo;
            </p>
          )}
        </div>
      </div>

      {/* Right: editor */}
      <div className="flex-1 flex flex-col overflow-hidden bg-argo-surface">
        <NoteEditor
          note={active}
          onTitleChange={handleTitleChange}
          onContentChange={handleContentChange}
        />
      </div>
    </div>
  )
}
