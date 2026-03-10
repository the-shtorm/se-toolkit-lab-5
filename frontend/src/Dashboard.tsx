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
  name: string
}

interface ScoreBucket {
  bucket: string
  count: number
}

interface ScoresResponse {
  lab_id: number
  buckets: ScoreBucket[]
}

interface TimelineEntry {
  date: string
  submissions: number
}

interface TimelineResponse {
  lab_id: number
  timeline: TimelineEntry[]
}

interface TaskPassRate {
  task_id: number
  task_name: string
  pass_rate: number
}

interface PassRatesResponse {
  lab_id: number
  pass_rates: TaskPassRate[]
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

  const [scoresState, scoresDispatch] = useReducer(
    fetchReducer<ScoresResponse>,
    { status: 'idle' },
  )
  const [timelineState, timelineDispatch] = useReducer(
    fetchReducer<TimelineResponse>,
    { status: 'idle' },
  )
  const [passRatesState, passRatesDispatch] = useReducer(
    fetchReducer<PassRatesResponse>,
    { status: 'idle' },
  )

  useEffect(() => {
    if (!selectedLabId) return

    const headers = { Authorization: `Bearer ${token}` }

    // Fetch scores
    scoresDispatch({ type: 'fetch_start' })
    fetch(`/analytics/scores?lab=${selectedLabId}`, { headers })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: ScoresResponse) =>
        scoresDispatch({ type: 'fetch_success', data }),
      )
      .catch((err: Error) =>
        scoresDispatch({ type: 'fetch_error', message: err.message }),
      )

    // Fetch timeline
    timelineDispatch({ type: 'fetch_start' })
    fetch(`/analytics/timeline?lab=${selectedLabId}`, { headers })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: TimelineResponse) =>
        timelineDispatch({ type: 'fetch_success', data }),
      )
      .catch((err: Error) =>
        timelineDispatch({ type: 'fetch_error', message: err.message }),
      )

    // Fetch pass rates
    passRatesDispatch({ type: 'fetch_start' })
    fetch(`/analytics/pass-rates?lab=${selectedLabId}`, { headers })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: PassRatesResponse) =>
        passRatesDispatch({ type: 'fetch_success', data }),
      )
      .catch((err: Error) =>
        passRatesDispatch({ type: 'fetch_error', message: err.message }),
      )
  }, [selectedLabId, token])

  const scoresChartData: ChartData<'bar'> = {
    labels: scoresState.status === 'success' ? scoresState.data.buckets.map((b) => b.bucket) : [],
    datasets: [
      {
        label: 'Submissions',
        data: scoresState.status === 'success' ? scoresState.data.buckets.map((b) => b.count) : [],
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
    ],
  }

  const timelineChartData: ChartData<'line'> = {
    labels: timelineState.status === 'success' ? timelineState.data.timeline.map((t) => t.date) : [],
    datasets: [
      {
        label: 'Submissions per Day',
        data: timelineState.status === 'success' ? timelineState.data.timeline.map((t) => t.submissions) : [],
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.1,
      },
    ],
  }

  const chartOptions: ChartOptions<'bar' | 'line'> = { responsive: true }

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
              {lab.name}
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
            <Bar data={scoresChartData} options={chartOptions} />
          )}
        </div>

        <div className="chart-section">
          <h2>Submissions Timeline</h2>
          {timelineState.status === 'loading' && <p>Loading...</p>}
          {timelineState.status === 'error' && <p>Error: {timelineState.message}</p>}
          {timelineState.status === 'success' && (
            <Line data={timelineChartData} options={chartOptions} />
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
                <th>Task ID</th>
                <th>Task Name</th>
                <th>Pass Rate (%)</th>
              </tr>
            </thead>
            <tbody>
              {passRatesState.data.pass_rates.map((pr) => (
                <tr key={pr.task_id}>
                  <td>{pr.task_id}</td>
                  <td>{pr.task_name}</td>
                  <td>{pr.pass_rate.toFixed(2)}</td>
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
