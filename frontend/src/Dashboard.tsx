import React, { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

type ScoreBucket = { bucket: "0-25" | "26-50" | "51-75" | "76-100"; count: number };
type TimelinePoint = { date: string; submissions: number };
type PassRate = { task: string; avg_score: number | null; attempts: number };

const DEFAULT_LABS = ["lab-01", "lab-02", "lab-03", "lab-04"];

async function fetchWithToken<T>(url: string): Promise<T> {
  const token = localStorage.getItem("api_key");
  const headers: HeadersInit = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export default function Dashboard(): JSX.Element {
  const [labs] = useState<string[]>(DEFAULT_LABS);
  const [selectedLab, setSelectedLab] = useState<string>(DEFAULT_LABS[0]);

  const [scores, setScores] = useState<ScoreBucket[] | null>(null);
  const [timeline, setTimeline] = useState<TimelinePoint[] | null>(null);
  const [passRates, setPassRates] = useState<PassRate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadAll() {
      setLoading(true);
      setError(null);
      try {
        const [s, t, p] = await Promise.all([
          fetchWithToken<ScoreBucket[]>(`/analytics/scores?lab=${encodeURIComponent(selectedLab)}`),
          fetchWithToken<TimelinePoint[]>(`/analytics/timeline?lab=${encodeURIComponent(selectedLab)}`),
          fetchWithToken<PassRate[]>(`/analytics/pass-rates?lab=${encodeURIComponent(selectedLab)}`),
        ]);
        if (!mounted) return;
        setScores(s);
        setTimeline(t);
        setPassRates(p);
      } catch (err) {
        // keep error message small and user-friendly
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadAll();
    return () => {
      mounted = false;
    };
  }, [selectedLab]);

  const barData = useMemo(() => {
    const bucketsOrder: ScoreBucket["bucket"][] = ["0-25", "26-50", "51-75", "76-100"];
    const counts = bucketsOrder.map((b) => scores?.find((s) => s.bucket === b)?.count ?? 0);
    return {
      labels: bucketsOrder,
      datasets: [
        {
          label: "Students",
          data: counts,
          backgroundColor: "rgba(54, 162, 235, 0.6)",
        },
      ],
    };
  }, [scores]);

  const lineData = useMemo(() => {
    if (!timeline) return { labels: [], datasets: [] };
    const labels = timeline.map((p) => p.date);
    const data = timeline.map((p) => p.submissions);
    return {
      labels,
      datasets: [
        {
          label: "Submissions",
          data,
          borderColor: "rgba(75,192,192,1)",
          backgroundColor: "rgba(75,192,192,0.2)",
          tension: 0.2,
        },
      ],
    };
  }, [timeline]);

  return (
    <div style={{ padding: 16, fontFamily: "Inter, system-ui, sans-serif" }}>
      <h2>Lab Analytics</h2>
      <div style={{ marginBottom: 12 }}>
        <label style={{ marginRight: 8 }}>Select lab:</label>
        <select value={selectedLab} onChange={(e) => setSelectedLab(e.target.value)}>
          {labs.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>

      {loading && <div>Loading...</div>}
      {error && <div style={{ color: "red" }}>Error: {error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <section style={{ background: "#fff", padding: 12, borderRadius: 8 }}>
          <h3>Score Distribution</h3>
          <Bar data={barData} />
        </section>

        <section style={{ background: "#fff", padding: 12, borderRadius: 8 }}>
          <h3>Submissions Over Time</h3>
          <Line data={lineData} />
        </section>
      </div>

      <section style={{ marginTop: 16, background: "#fff", padding: 12, borderRadius: 8 }}>
        <h3>Pass Rates by Task</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 8 }}>Task</th>
              <th style={{ textAlign: "right", padding: 8 }}>Avg Score</th>
              <th style={{ textAlign: "right", padding: 8 }}>Attempts</th>
            </tr>
          </thead>
          <tbody>
            {(passRates ?? []).map((r) => (
              <tr key={r.task}>
                <td style={{ padding: 8, borderTop: "1px solid #eee" }}>{r.task}</td>
                <td style={{ padding: 8, textAlign: "right", borderTop: "1px solid #eee" }}>
                  {r.avg_score === null ? "—" : r.avg_score.toFixed(1)}
                </td>
                <td style={{ padding: 8, textAlign: "right", borderTop: "1px solid #eee" }}>{r.attempts}</td>
              </tr>
            ))}
            {passRates && passRates.length === 0 && (
              <tr>
                <td colSpan={3} style={{ padding: 8 }}>
                  No tasks found for this lab.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
