import { useState, useEffect, useReducer, FormEvent } from 'react'
import './App.css'
import { Dashboard } from './Dashboard'

const STORAGE_KEY = 'api_key'

interface Item {
  id: number
  type: string
  title: string
  created_at: string
}

interface Lab {
  id: number
  name: string
}

type FetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; items: Item[] }
  | { status: 'error'; message: string }

type FetchAction =
  | { type: 'fetch_start' }
  | { type: 'fetch_success'; data: Item[] }
  | { type: 'fetch_error'; message: string }

function fetchReducer(_state: FetchState, action: FetchAction): FetchState {
  switch (action.type) {
    case 'fetch_start':
      return { status: 'loading' }
    case 'fetch_success':
      return { status: 'success', items: action.data }
    case 'fetch_error':
      return { status: 'error', message: action.message }
  }
}

type Page = 'items' | 'dashboard'

function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem(STORAGE_KEY) ?? '',
  )
  const [draft, setDraft] = useState('')
  const [currentPage, setCurrentPage] = useState<Page>('items')
  const [fetchState, dispatch] = useReducer(fetchReducer, { status: 'idle' })
  const [labs, setLabs] = useState<Lab[]>([])
  const [labsLoading, setLabsLoading] = useState(false)
  const [labsError, setLabsError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return

    dispatch({ type: 'fetch_start' })
    setLabsLoading(true)

    Promise.all([
      fetch('/items/', { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return res.json()
        }),
    ])
      .then(([itemsData]) => {
        dispatch({ type: 'fetch_success', data: itemsData })
        const labsData = itemsData.filter((item: Item) => item.type === 'lab')
        setLabs(labsData)
        setLabsLoading(false)
      })
      .catch((err: Error) => {
        dispatch({ type: 'fetch_error', message: err.message })
        setLabsError(err.message)
        setLabsLoading(false)
      })
  }, [token])

  function handleConnect(e: FormEvent) {
    e.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed) return
    localStorage.setItem(STORAGE_KEY, trimmed)
    setToken(trimmed)
  }

  function handleDisconnect() {
    localStorage.removeItem(STORAGE_KEY)
    setToken('')
    setDraft('')
  }

  if (!token) {
    return (
      <form className="token-form" onSubmit={handleConnect}>
        <h1>API Key</h1>
        <p>Enter your API key to connect.</p>
        <input
          type="password"
          placeholder="Token"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit">Connect</button>
      </form>
    )
  }

  return (
    <div>
      <header className="app-header">
        <nav className="nav-links">
          <button
            className={`nav-btn ${currentPage === 'items' ? 'active' : ''}`}
            onClick={() => setCurrentPage('items')}
          >
            Items
          </button>
          <button
            className={`nav-btn ${currentPage === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentPage('dashboard')}
          >
            Dashboard
          </button>
        </nav>
        <button className="btn-disconnect" onClick={handleDisconnect}>
          Disconnect
        </button>
      </header>

      {currentPage === 'dashboard' ? (
        labsError ? (
          <div>
            <p>Error loading labs: {labsError}</p>
          </div>
        ) : labsLoading ? (
          <p>Loading labs...</p>
        ) : labs.length === 0 ? (
          <p>No labs available.</p>
        ) : (
          <Dashboard labs={labs} token={token} onDisconnect={handleDisconnect} />
        )
      ) : (
        <>
          {fetchState.status === 'loading' && <p>Loading...</p>}
          {fetchState.status === 'error' && <p>Error: {fetchState.message}</p>}

          {fetchState.status === 'success' && (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>ItemType</th>
                  <th>Title</th>
                  <th>Created at</th>
                </tr>
              </thead>
              <tbody>
                {fetchState.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.type}</td>
                    <td>{item.title}</td>
                    <td>{item.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  )
}

export default App
