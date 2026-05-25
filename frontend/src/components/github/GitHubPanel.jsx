import { useCallback, useEffect, useState } from 'react'
import { GitBranch } from 'lucide-react'

const API = '/api/v1/github'

function Section({ title, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '.07em', textTransform: 'uppercase' }}>{title}</p>
      {children}
    </div>
  )
}

function Row({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', justifyContent: 'space-between' }}>
      <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{label}</span>
      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: mono ? 'monospace' : undefined }}>{value}</span>
    </div>
  )
}

function RepoCard({ repo, onSelect, selected }) {
  const isSelected = selected?.id === repo.id
  return (
    <button
      onClick={() => onSelect(repo)}
      style={{
        width: '100%',
        textAlign: 'left',
        background: isSelected ? 'var(--bg-active)' : 'var(--bg-card)',
        border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        padding: '10px 14px',
        cursor: 'pointer',
        transition: 'all 150ms',
      }}
    >
      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{repo.full_name}</div>
      {repo.description && (
        <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px', lineHeight: 1.4 }}>
          {repo.description.slice(0, 80)}{repo.description.length > 80 ? '…' : ''}
        </div>
      )}
      <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
        {repo.language && <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{repo.language}</span>}
        <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>★ {repo.stargazers_count ?? 0}</span>
        <span style={{ fontSize: '11px', color: repo.private ? 'var(--warning)' : 'var(--text-dim)' }}>
          {repo.private ? 'private' : 'public'}
        </span>
      </div>
    </button>
  )
}

function PRList({ prs }) {
  if (!prs?.length) return <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>No open PRs</p>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {prs.map((pr) => (
        <div key={pr.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500 }}>
              #{pr.number} {pr.title}
            </span>
            <span style={{ fontSize: '11px', color: pr.state === 'open' ? 'var(--success)' : 'var(--text-dim)', fontWeight: 700 }}>{pr.state}</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
            {pr.head?.ref} → {pr.base?.ref} · by {pr.user?.login}
          </div>
        </div>
      ))}
    </div>
  )
}

function CommitList({ commits }) {
  if (!commits?.length) return <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>No commits</p>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {commits.map((c) => (
        <div key={c.sha} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 12px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.4 }}>
            {c.commit?.message?.split('\n')[0]}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px', fontFamily: 'monospace' }}>
            {c.sha.slice(0, 7)} · {c.commit?.author?.name} · {c.commit?.author?.date?.slice(0, 10)}
          </div>
        </div>
      ))}
    </div>
  )
}

function RepoDetail({ repo, token }) {
  const [branches, setBranches] = useState([])
  const [prs, setPRs] = useState([])
  const [commits, setCommits] = useState([])
  const [tab, setTab] = useState('prs')

  const [owner, repoName] = repo.full_name.split('/')

  useEffect(() => {
    const q = `?access_token=${encodeURIComponent(token)}`
    fetch(`${API}/repos/${owner}/${repoName}/branches${q}`).then((r) => r.json()).then(setBranches).catch(() => {})
    fetch(`${API}/repos/${owner}/${repoName}/pulls${q}`).then((r) => r.json()).then(setPRs).catch(() => {})
    fetch(`${API}/repos/${owner}/${repoName}/commits${q}`).then((r) => r.json()).then(setCommits).catch(() => {})
  }, [owner, repoName, token])

  const TabBtn = ({ id, label }) => (
    <button
      onClick={() => setTab(id)}
      style={{
        padding: '4px 12px',
        borderRadius: '9999px',
        border: tab === id ? '1px solid rgba(0,122,255,0.4)' : '1px solid transparent',
        background: tab === id ? 'rgba(0,122,255,0.1)' : 'transparent',
        color: tab === id ? 'var(--accent)' : 'var(--text-dim)',
        fontSize: '12px',
        fontWeight: tab === id ? 600 : 400,
        cursor: 'pointer',
      }}
    >{label}</button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
        <Row label="Branches" value={branches.map((b) => b.name).join(', ') || '—'} />
        <div style={{ height: '8px' }} />
        <Row label="Default branch" value={repo.default_branch} mono />
      </div>

      <div style={{ display: 'flex', gap: '4px' }}>
        <TabBtn id="prs" label={`PRs (${prs.length})`} />
        <TabBtn id="commits" label={`Commits (${commits.length})`} />
      </div>

      {tab === 'prs' && <PRList prs={prs} />}
      {tab === 'commits' && <CommitList commits={commits} />}
    </div>
  )
}

export function GitHubPanel() {
  const [token, setToken] = useState(() => sessionStorage.getItem('gh_token') ?? '')
  const [tokenInput, setTokenInput] = useState('')
  const [user, setUser] = useState(null)
  const [repos, setRepos] = useState([])
  const [selectedRepo, setSelectedRepo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const loadUser = useCallback(async (t) => {
    setLoading(true)
    setError(null)
    try {
      const [u, r] = await Promise.all([
        fetch(`${API}/user?access_token=${encodeURIComponent(t)}`).then((res) => res.json()),
        fetch(`${API}/repos?access_token=${encodeURIComponent(t)}&per_page=30`).then((res) => res.json()),
      ])
      if (u.message) throw new Error(u.message)
      setUser(u)
      setRepos(Array.isArray(r) ? r : [])
      sessionStorage.setItem('gh_token', t)
      setToken(t)
    } catch (err) {
      setError(err.message)
      sessionStorage.removeItem('gh_token')
      setToken('')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (token) loadUser(token)
  }, []) // only on mount

  const handleConnect = async (e) => {
    e.preventDefault()
    if (!tokenInput.trim()) return
    await loadUser(tokenInput.trim())
  }

  const handleDisconnect = () => {
    setToken('')
    setTokenInput('')
    setUser(null)
    setRepos([])
    setSelectedRepo(null)
    sessionStorage.removeItem('gh_token')
  }

  // Not authenticated
  if (!token || !user) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', gap: '16px' }}>
        <GitBranch size={32} style={{ opacity: 0.5 }} />
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Connect GitHub</div>
        <p style={{ fontSize: '13px', color: 'var(--text-dim)', textAlign: 'center', maxWidth: '340px', lineHeight: 1.6 }}>
          Enter a Personal Access Token (PAT) with <code style={{ color: 'var(--accent)' }}>repo</code> and <code style={{ color: 'var(--accent)' }}>read:user</code> scopes.
        </p>
        {error && (
          <div style={{ background: 'var(--error-soft)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', padding: '8px 14px', fontSize: '12px', color: 'var(--error)' }}>
            {error}
          </div>
        )}
        <form onSubmit={handleConnect} style={{ display: 'flex', gap: '8px', width: '100%', maxWidth: '420px' }}>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="ghp_…"
            style={{
              flex: 1,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              padding: '9px 12px',
              fontSize: '13px',
              color: 'var(--text-primary)',
              outline: 'none',
              fontFamily: 'monospace',
            }}
          />
          <button
            type="submit"
            disabled={loading || !tokenInput.trim()}
            style={{
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              padding: '9px 20px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? '…' : 'Connect'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* Left: user + repos */}
      <div style={{ width: '300px', flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* User card */}
        <div style={{ padding: '14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {user.avatar_url && (
            <img src={user.avatar_url} alt="avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid var(--border)' }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name ?? user.login}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>@{user.login}</div>
          </div>
          <button
            onClick={handleDisconnect}
            title="Disconnect"
            style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '3px 8px', fontSize: '11px', color: 'var(--text-dim)', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
        {/* Repo list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: '4px' }}>
            Repositories ({repos.length})
          </p>
          {repos.map((r) => (
            <RepoCard key={r.id} repo={r} selected={selectedRepo} onSelect={setSelectedRepo} />
          ))}
        </div>
      </div>

      {/* Right: repo detail */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {!selectedRepo ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontSize: '14px', color: 'var(--text-dim)' }}>Select a repository</p>
          </div>
        ) : (
          <>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>{selectedRepo.full_name}</h2>
              {selectedRepo.description && (
                <p style={{ fontSize: '13px', color: 'var(--text-dim)', lineHeight: 1.5 }}>{selectedRepo.description}</p>
              )}
            </div>
            <RepoDetail repo={selectedRepo} token={token} />
          </>
        )}
      </div>
    </div>
  )
}
