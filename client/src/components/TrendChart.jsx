import { useState, useEffect } from 'react'

const RISK_COLORS = { E: '#FF4D4D', D: '#FF8C42', C: '#FFD93D', B: '#6BCB77', A: '#3DA35D' }

export default function TrendChart({ country }) {
  const [trends, setTrends] = useState(null)

  useEffect(() => {
    fetch('/data/risk_trends.json').then(r => r.json()).then(setTrends).catch(() => {})
  }, [])

  if (!trends || !country) return null
  const data = trends.by_country?.[country]
  if (!data) return null

  const years = Object.keys(data).sort()
  const values = years.map(y => data[y])
  const maxVal = Math.max(...values, 50)

  return (
    <div className="trend-section">
      <div className="section-label">Evolution du risque 2020-2024</div>
      <div className="trend-chart">
        {years.map((y, i) => {
          const v = values[i]
          const h = Math.max(4, (v / maxVal) * 60)
          const cls = v >= 75 ? 'E' : v >= 55 ? 'D' : v >= 40 ? 'C' : v >= 25 ? 'B' : 'A'
          return (
            <div key={y} className="trend-bar-group">
              <div className="trend-val">{v}</div>
              <div className="trend-bar" style={{ height: `${h}px`, background: RISK_COLORS[cls], boxShadow: `0 0 6px ${RISK_COLORS[cls]}44` }} />
              <div className="trend-year">{y}</div>
            </div>
          )
        })}
      </div>
      {values[values.length - 1] > values[0] && (
        <div className="trend-warning">
          Risque en hausse de +{values[values.length - 1] - values[0]} pts depuis {years[0]}
        </div>
      )}
    </div>
  )
}
