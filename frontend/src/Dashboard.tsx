import { useState, useEffect, useReducer, FormEvent } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions,
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
)

const STORAGE_KEY = 'api_key'

interface Lab {
  id: number
  title: string
}

interface ScoreBucket {
  bucket: string
  count: number
}

interface TimelineEntry {
  date: string
  submissions: number
}

interface TaskPassRate {
  task: string
  avg_score: number | null
  attempts: number
}

type FetchState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; message: string }

type FetchAction<T> =
  | { type: 'fetch_start' }
  | { type: 'fetch_success'; data: T }
  | { type: 'fetch_error'; message: string }

function fetchReducer<T>(
  state: FetchState<T>,
  action: FetchAction<T>,
): FetchState<T> {
  switch (action.type) {
    case 'fetch_start':
      return { status: 'loading' }
    case 'fetch_success':
      return { status: 'success', data: action.data }
    case 'fetch_error':
      return { status: 'error', message: action.message }
  }
}

interface DashboardProps {
  labs: Lab[]
  token: string
  onDisconnect: () => void
}

function Dashboard({ labs, token, onDisconnect }: DashboardProps) {
  const [selectedLabId, setSelectedLabId] = useState<number>(
    labs.length > 0 ? labs[0].id : 0,
  )

  console.log('Dashboard received labs:', labs)

  const [scoresState, scoresDispatch] = useReducer(
    fetchReducer<ScoreBucket[]>,
    { status: 'idle' },
  )
  const [timelineState, timelineDispatch] = useReducer(
    fetchReducer<TimelineEntry[]>,
    { status: 'idle' },
  )
  const [passRatesState, passRatesDispatch] = useReducer(
    fetchReducer<TaskPassRate[]>,
    { status: 'idle' },
  )

  useEffect(() => {
    if (!selectedLabId) return

    const lab = labs.find((l) => l.id === selectedLabId)
    if (!lab) return

    const headers = { Authorization: `Bearer ${token}` }
    const labParam = lab.title

    // Fetch scores
    scoresDispatch({ type: 'fetch_start' })
    fetch(`/analytics/scores?lab=${encodeURIComponent(labParam)}`, { headers })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: ScoreBucket[]) => {
        console.log('Scores data:', data)
        scoresDispatch({ type: 'fetch_success', data })
      })
      .catch((err: Error) =>
        scoresDispatch({ type: 'fetch_error', message: err.message }),
      )

    // Fetch timeline
    timelineDispatch({ type: 'fetch_start' })
    fetch(`/analytics/timeline?lab=${encodeURIComponent(labParam)}`, { headers })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: TimelineEntry[]) => {
        console.log('Timeline data:', data)
        timelineDispatch({ type: 'fetch_success', data })
      })
      .catch((err: Error) =>
        timelineDispatch({ type: 'fetch_error', message: err.message }),
      )

    // Fetch pass rates
    passRatesDispatch({ type: 'fetch_start' })
    fetch(`/analytics/pass-rates?lab=${encodeURIComponent(labParam)}`, { headers })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: TaskPassRate[]) => {
        console.log('Pass rates data:', data)
        passRatesDispatch({ type: 'fetch_success', data })
      })
      .catch((err: Error) =>
        passRatesDispatch({ type: 'fetch_error', message: err.message }),
      )
  }, [selectedLabId, token, labs])

  const scoresChartData: ChartData<'bar'> = {
    labels: scoresState.status === 'success' ? scoresState.data.map((b) => b.bucket) : [],
    datasets: [
      {
        label: 'Submissions',
        data: scoresState.status === 'success' ? scoresState.data.map((b) => b.count) : [],
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
    ],
  }

  const timelineChartData: ChartData<'line'> = {
    labels: timelineState.status === 'success' ? timelineState.data.map((t) => t.date) : [],
    datasets: [
      {
        label: 'Submissions per Day',
        data: timelineState.status === 'success' ? timelineState.data.map((t) => t.submissions) : [],
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.1,
      },
    ],
  }

  const chartOptions: ChartOptions<'bar' | 'line'> = { 
    responsive: true,
    plugins: {
      legend: {
        display: true,
      },
    },
  }

  return (
    <div>
      <header className="app-header">
        <h1>Dashboard</h1>
        <button className="btn-disconnect" onClick={onDisconnect}>
          Disconnect
        </button>
      </header>

      <div className="lab-selector">
        <label htmlFor="lab-select">Select Lab: </label>
        <select
          id="lab-select"
          value={selectedLabId}
          onChange={(e) => setSelectedLabId(Number(e.target.value))}
        >
          {labs.map((lab) => (
            <option key={lab.id} value={lab.id}>
              {lab.title}
            </option>
          ))}
        </select>
      </div>

      <div className="charts-container">
        <div className="chart-section">
          <h2>Score Buckets</h2>
          {scoresState.status === 'loading' && <p>Loading...</p>}
          {scoresState.status === 'error' && <p>Error: {scoresState.message}</p>}
          {scoresState.status === 'success' && (
            scoresState.data.length === 0 ? (
              <p>No data available</p>
            ) : (
              <Bar data={scoresChartData} options={chartOptions} />
            )
          )}
        </div>

        <div className="chart-section">
          <h2>Submissions Timeline</h2>
          {timelineState.status === 'loading' && <p>Loading...</p>}
          {timelineState.status === 'error' && <p>Error: {timelineState.message}</p>}
          {timelineState.status === 'success' && (
            timelineState.data.length === 0 ? (
              <p>No data available</p>
            ) : (
              <Line data={timelineChartData} options={chartOptions} />
            )
          )}
        </div>
      </div>

      <div className="pass-rates-section">
        <h2>Pass Rates per Task</h2>
        {passRatesState.status === 'loading' && <p>Loading...</p>}
        {passRatesState.status === 'error' && <p>Error: {passRatesState.message}</p>}
        {passRatesState.status === 'success' && (
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Avg Score</th>
                <th>Attempts</th>
              </tr>
            </thead>
            <tbody>
              {passRatesState.data.map((pr, idx) => (
                <tr key={idx}>
                  <td>{pr.task}</td>
                  <td>{pr.avg_score !== null ? pr.avg_score.toFixed(1) : 'N/A'}</td>
                  <td>{pr.attempts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

interface RootDashboardProps {
  initialToken?: string
}

function DashboardRoot({ initialToken }: RootDashboardProps) {
  const [token, setToken] = useState(() => initialToken ?? localStorage.getItem(STORAGE_KEY) ?? '')
  const [draft, setDraft] = useState('')
  const [labs, setLabs] = useState<Lab[]>([])
  const [labsLoading, setLabsLoading] = useState(false)
  const [labsError, setLabsError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return

    setLabsLoading(true)
    fetch('/labs/', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: Lab[]) => {
        setLabs(data)
        setLabsLoading(false)
      })
      .catch((err: Error) => {
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

  if (labsLoading) {
    return <p>Loading labs...</p>
  }

  if (labsError) {
    return (
      <div>
        <p>Error: {labsError}</p>
        <button onClick={handleDisconnect}>Disconnect</button>
      </div>
    )
  }

  if (labs.length === 0) {
    return (
      <div>
        <p>No labs available.</p>
        <button onClick={handleDisconnect}>Disconnect</button>
      </div>
    )
  }

  return <Dashboard labs={labs} token={token} onDisconnect={handleDisconnect} />
}

export { Dashboard }
export default DashboardRoot
