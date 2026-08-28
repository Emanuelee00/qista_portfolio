import { useState, useEffect } from 'react'

// Mapping NUTS3 -> NUTS2 pour le tourisme
const NUTS3_TO_NUTS2 = {}
// Auto-generate: NUTS3 code prefix = NUTS2 (first 4 chars)
function getNuts2(nuts3) {
  return nuts3?.substring(0, 4) || ''
}

export default function TourismImpact({ nutsId, riskClass, total }) {
  const [tourism, setTourism] = useState(null)

  useEffect(() => {
    fetch('/data/tourism_nuts2.json').then(r => r.json()).then(setTourism).catch(() => {})
  }, [])

  if (!tourism || !nutsId) return null
  const nuts2 = getNuts2(nutsId)
  const data = tourism[nuts2]
  if (!data) return null

  // Estimation impact economique (depense moyenne par nuitee ~100€)
  const nights = data.nights_2023
  const nightsM = (nights / 1e6).toFixed(1)
  const riskFactor = total >= 75 ? 0.15 : total >= 55 ? 0.08 : total >= 40 ? 0.04 : 0.01
  const estimatedLoss = Math.round(nights * riskFactor * 0.5) // 50% de la depense impactee
  const lossM = (estimatedLoss / 1e6).toFixed(1)

  return (
    <div className="tourism-section">
      <div className="section-label">Impact economique tourisme</div>
      <div className="tourism-stats">
        <div className="tourism-stat">
          <span className="tourism-val">{nightsM}M</span>
          <span className="tourism-lbl">Nuitees / an</span>
        </div>
        <div className="tourism-stat">
          <span className="tourism-val warn">{lossM}M€</span>
          <span className="tourism-lbl">Impact estime</span>
        </div>
      </div>
      <div className="tourism-note">
        {data.name} — Perte estimee liee au risque moustique sur l'attractivite touristique
      </div>
    </div>
  )
}
