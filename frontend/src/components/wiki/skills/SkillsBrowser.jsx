import { useCallback, useEffect, useRef, useState } from 'react'
import { Search, Upload, Wrench, X } from 'lucide-react'
import SkillCard from './SkillCard'

const API = '/api/v1/argon'

const s = {
  root: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' },
  toolbar: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '10px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0,
  },
  search: {
    flex: 1, display: 'flex', alignItems: 'center', gap: '8px',
    background: 'var(--bg-overlay)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', padding: '5px 10px',
  },
  searchInput: {
    background: 'transparent', border: 'none', 
    fontSize: '13px', color: 'var(--text-primary)', fontFamily: 'var(--f-ui)', flex: 1,
  },
  uploadBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    background: 'var(--accent-grad)', color: '#000', fontWeight: 700,
    fontSize: '12px', padding: '5px 12px', borderRadius: 'var(--radius-sm)',
    border: 'none', cursor: 'pointer', flexShrink: 0,
  },
  grid: {
    flex: 1, overflow: 'auto', padding: '14px',
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '12px', alignContent: 'start',
  },
  loading: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '120px', color: 'var(--text-dim)', fontSize: '13px',
  },
  empty: {
    gridColumn: '1/-1', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', padding: '40px',
    gap: '10px', color: 'var(--text-dim)', fontSize: '13px',
  },
  detailOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  detailModal: {
    width: '580px', maxWidth: '90vw', maxHeight: '80vh',
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', boxShadow: 'var(--sh-3)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  detailHeader: {
    padding: '16px 20px', borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'flex-start', gap: '12px',
  },
  detailBody: { flex: 1, overflow: 'auto', padding: '16px 20px' },
  detailFooter: {
    padding: '12px 20px', borderTop: '1px solid var(--border)',
    display: 'flex', gap: '8px', justifyContent: 'flex-end',
  },
  btn: {
    background: 'transparent', color: 'var(--text-secondary)',
    fontSize: '13px', padding: '6px 14px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)', cursor: 'pointer',
  },
}

function SkillDetail({ skill, onClose }) {
  return (
    <div style={s.detailOverlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={s.detailModal}>
        <div style={s.detailHeader}>
          <Wrench size={28} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {skill.name || skill.slug}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>
              v{skill.current_version || '–'} · {skill.slug}
            </div>
          </div>
          <button style={{ ...s.btn, padding: '4px 8px', display: 'flex', alignItems: 'center' }} onClick={onClose}><X size={14} /></button>
        </div>
        <div style={s.detailBody}>
          {skill.description && (
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '16px' }}>
              {skill.description}
            </p>
          )}
          {skill.tags?.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
              {skill.tags.map((t) => (
                <span key={t} style={{ fontSize: '11px', background: 'var(--accent-soft)', color: 'var(--accent)', borderRadius: '4px', padding: '2px 8px', fontWeight: 600 }}>
                  {t}
                </span>
              ))}
            </div>
          )}
          <div style={{ fontSize: '12px', color: 'var(--text-dim)', background: 'var(--bg-overlay)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
            <span style={{ fontWeight: 600 }}>Status:</span> {skill.status} &nbsp;·&nbsp;
            <span style={{ fontWeight: 600 }}>Versions:</span> {skill.current_version || 1}
          </div>
        </div>
        <div style={s.detailFooter}>
          <button style={s.btn} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

export default function SkillsBrowser() {
  const [skills, setSkills] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const fileInputRef = useRef(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`${API}/skills?limit=100`)
      .then((r) => r.ok ? r.json() : { items: [] })
      .then((data) => setSkills(data.items || data || []))
      .catch(() => setSkills([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    await fetch(`${API}/skills/upload`, { method: 'POST', body: fd })
    load()
    e.target.value = ''
  }

  const filtered = skills.filter((sk) => {
    if (!query) return true
    const q = query.toLowerCase()
    return (sk.name || sk.slug || '').toLowerCase().includes(q) ||
      (sk.description || '').toLowerCase().includes(q)
  })

  return (
    <div style={s.root}>
      <div style={s.toolbar}>
        <div style={s.search}>
          <Search size={13} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
          <input
            style={s.searchInput}
            placeholder="Search skills…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <input ref={fileInputRef} type="file" accept=".zip" style={{ display: 'none' }} onChange={handleUpload} />
        <button style={{ ...s.uploadBtn, gap: '6px', display: 'flex', alignItems: 'center' }} onClick={() => fileInputRef.current?.click()}>
          <Upload size={12} /> Upload skill
        </button>
      </div>

      <div style={s.grid}>
        {loading && <div style={s.loading}>Loading skills…</div>}
        {!loading && filtered.length === 0 && (
          <div style={s.empty}>
            <Wrench size={32} style={{ opacity: 0.3 }} />
            <span>{query ? 'No skills match your search' : 'No skills uploaded yet'}</span>
          </div>
        )}
        {filtered.map((sk) => (
          <SkillCard key={sk.id || sk.slug} skill={sk} onClick={setSelected} />
        ))}
      </div>

      {selected && <SkillDetail skill={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
