import { useEffect, useState } from 'react'
import './App.css'

const NAME_MAX = 40
const MESSAGE_MAX = 500

async function readError(response) {
  try {
    const body = await response.json()
    if (body.error) return body.error
  } catch {
    // JSON이 아니면 아래 기본 문장을 써요.
  }
  return `서버가 요청을 처리하지 못했어요. (${response.status})`
}

function formatTime(iso) {
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function App() {
  const [entries, setEntries] = useState([])
  const [name, setName] = useState('')
  const [to, setTo] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    fetch('/api/entries')
      .then(async (response) => {
        if (!response.ok) throw new Error(await readError(response))
        return response.json()
      })
      .then((body) => setEntries(body.entries))
      .catch((e) => setLoadError(e.message || '칭찬 목록을 불러오지 못했어요.'))
  }, [])

  const canSubmit = name.trim() !== '' && message.trim() !== '' && !saving

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, message, to }),
      })
      if (!response.ok) {
        setError(await readError(response))
        return
      }
      const { entry } = await response.json()
      setEntries((current) => [entry, ...current].slice(0, 200))
      setTo('')
      setMessage('')
    } catch {
      setError('서버에 연결할 수 없어요. 잠시 뒤 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="page">
      <header className="header">
        <h1>칭찬 릴레이</h1>
        <p>로그인 없이 이름만 적고, 함께 배운 동기에게 칭찬을 건네 보세요.</p>
      </header>

      <form className="form" onSubmit={handleSubmit}>
        <div className="row">
          <label className="field">
            <span>칭찬하는 사람</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={NAME_MAX}
              placeholder="내 이름"
              required
            />
          </label>
          <label className="field">
            <span>
              칭찬받는 사람 <small>(선택)</small>
            </span>
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              maxLength={NAME_MAX}
              placeholder="비워 두어도 괜찮아요"
            />
          </label>
        </div>
        <label className="field">
          <span>칭찬 한마디</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={MESSAGE_MAX}
            rows={3}
            placeholder="고마웠던 점을 적어 주세요"
            required
          />
        </label>
        <div className="actions">
          <span className="counter">
            {message.length} / {MESSAGE_MAX}
          </span>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={!canSubmit}>
            {saving ? '저장하는 중…' : '칭찬 남기기'}
          </button>
        </div>
      </form>

      <section className="list">
        <div className="list-head">
          <h2>칭찬 목록</h2>
          <span>최신 칭찬이 맨 앞이에요</span>
        </div>
        {loadError && (
          <p className="error" role="alert">
            {loadError}
          </p>
        )}
        {!loadError && entries.length === 0 && (
          <p className="empty">아직 칭찬이 없어요. 첫 칭찬을 남겨 보세요!</p>
        )}
        <ul className="cards">
          {entries.map((entry) => (
            <li key={entry.id} className="card">
              <p className="who">
                {entry.name}
                {entry.to && <span className="to"> → {entry.to}</span>}
              </p>
              <p className="message">{entry.message}</p>
              <time dateTime={entry.created_at}>{formatTime(entry.created_at)}</time>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}

export default App
