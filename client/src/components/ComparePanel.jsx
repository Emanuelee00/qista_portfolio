import { useState } from 'react'

const RISK_COLORS = { E: '#FF4D4D', D: '#FF8C42', C: '#FFD93D', B: '#6BCB77', A: '#3DA35D' }
const RISK_LABELS = { E: 'Critique', D: 'Eleve', C: 'Modere', B: 'Faible', A: 'Tres faible' }

function MiniSearch({ nutsData, onSelect, placeholder }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)

  function search(val) {
    setQ(val)
    if (!nutsData || val.length < 2) { setResults([]); return }
    const lc = val.toLowerCase()
    setResults(Object.entries(nutsData)
      .filter(([id, d]) => d.name.toLowerCase().includes(lc) || id.toLowerCase().includes(lc))
      .sort((a, b) => b[1].total - a[1].total).slice(0, 5))
  }

  return (
    <div className="mini-search">
      <input type="text" value={q} placeholder={placeholder}
        onChange={e => { search(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 200)} />
      {open && results.length > 0 && (
        <div className="mini-search-results">
          {results.map(([id, d]) => (
            <div key={id} className="mini-search-item" onMouseDown={() => { onSelect(id); setQ(d.name); setOpen(false) }}>
              <span>{d.name}</span>
              <span style={{ color: RISK_COLORS[d.risk_class] }}>{d.total}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ScoreBar({ label, v1, v2, max }) {
  const pct1 = (v1 / max) * 100, pct2 = (v2 / max) * 100
  return (
    <div className="compare-score-row">
      <span className="compare-label">{label}</span>
      <div className="compare-bars">
        <div className="compare-bar-bg"><div className="compare-bar-fill left" style={{ width: `${pct1}%` }} /></div>
        <div className="compare-bar-bg"><div className="compare-bar-fill right" style={{ width: `${pct2}%` }} /></div>
      </div>
      <div className="compare-vals"><span>{v1}</span><span>{v2}</span></div>
    </div>
  )
}

export default function ComparePanel({ nutsData, onClose }) {
  const [region1, setRegion1] = useState(null)
  const [region2, setRegion2] = useState(null)

  const d1 = region1 ? nutsData?.[region1] : null
  const d2 = region2 ? nutsData?.[region2] : null

  return (
    <div className="detail-panel fade-in">
      <button className="close-btn" onClick={onClose}>x</button>
      <h2>Comparer 2 regions</h2>

      <div className="compare-searches">
        <MiniSearch nutsData={nutsData} onSelect={setRegion1} placeholder="Region 1..." />
        <span className="compare-vs">VS</span>
        <MiniSearch nutsData={nutsData} onSelect={setRegion2} placeholder="Region 2..." />
      </div>

      {d1 && d2 && (
        <div className="compare-result">
          <div className="compare-header-row">
            <div className="compare-col">
              <span className="compare-name">{d1.name}</span>
              <span className="compare-total" style={{ color: RISK_COLORS[d1.risk_class] }}>{d1.total}/100</span>
              <span className="compare-class" style={{ background: RISK_COLORS[d1.risk_class] + '22', color: RISK_COLORS[d1.risk_class] }}>{d1.risk_class} - {RISK_LABELS[d1.risk_class]}</span>
            </div>
            <div className="compare-col">
              <span className="compare-name">{d2.name}</span>
              <span className="compare-total" style={{ color: RISK_COLORS[d2.risk_class] }}>{d2.total}/100</span>
              <span className="compare-class" style={{ background: RISK_COLORS[d2.risk_class] + '22', color: RISK_COLORS[d2.risk_class] }}>{d2.risk_class} - {RISK_LABELS[d2.risk_class]}</span>
            </div>
          </div>

          <div className="section-label" style={{ marginTop: 16 }}>Detail par dimension</div>
          <ScoreBar label="S - Especes" v1={d1.s} v2={d2.s} max={22} />
          <ScoreBar label="C - Climat" v1={d1.c} v2={d2.c} max={22} />
          <ScoreBar label="D - Maladies" v1={d1.d} v2={d2.d} max={22} />
          <ScoreBar label="O - Observations" v1={d1.o} v2={d2.o} max={19} />
          <ScoreBar label="W - Eau" v1={d1.w || 0} v2={d2.w || 0} max={15} />

          <div className="compare-verdict">
            {d1.total > d2.total
              ? <span><strong>{d1.name}</strong> est <span style={{ color: '#FF4D4D' }}>plus a risque</span> que {d2.name} (+{d1.total - d2.total} pts)</span>
              : d1.total < d2.total
              ? <span><strong>{d2.name}</strong> est <span style={{ color: '#FF4D4D' }}>plus a risque</span> que {d1.name} (+{d2.total - d1.total} pts)</span>
              : <span>Les deux regions ont un <strong>risque equivalent</strong></span>
            }
          </div>
        </div>
      )}
    </div>
  )
}
