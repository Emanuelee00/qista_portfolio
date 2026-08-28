import { useState, useEffect } from 'react'

const RISK_COLORS = { E: '#FF4D4D', D: '#FF8C42', C: '#FFD93D', B: '#6BCB77', A: '#3DA35D' }

export default function AlertsPanel({ onSelectRegion }) {
  const [alerts, setAlerts] = useState([])

  useEffect(() => {
    fetch('/data/alerts.json').then(r => r.json()).then(setAlerts).catch(() => {})
  }, [])

  if (!alerts.length) return null

  const critical = alerts.filter(a => a.type === 'critical')
  const warnings = alerts.filter(a => a.type === 'warning')

  return (
    <div className="alerts-panel">
      <div className="alerts-header">
        <span className="alerts-icon">!</span>
        <span className="alerts-title">{alerts.length} alertes actives</span>
      </div>
      <div className="alerts-list">
        {critical.map(a => (
          <div key={a.nuts_id} className="alert-item critical" onClick={() => onSelectRegion(a.nuts_id)}>
            <span className="alert-dot" style={{ background: RISK_COLORS.E }} />
            <div className="alert-info">
              <span className="alert-name">{a.name}</span>
              <span className="alert-msg">{a.message}</span>
            </div>
            <span className="alert-score" style={{ color: RISK_COLORS.E }}>{a.score}</span>
          </div>
        ))}
        {warnings.slice(0, 5).map(a => (
          <div key={a.nuts_id} className="alert-item warning" onClick={() => onSelectRegion(a.nuts_id)}>
            <span className="alert-dot" style={{ background: RISK_COLORS.D }} />
            <div className="alert-info">
              <span className="alert-name">{a.name}</span>
              <span className="alert-msg">{a.message}</span>
            </div>
            <span className="alert-score" style={{ color: RISK_COLORS.D }}>{a.score}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
