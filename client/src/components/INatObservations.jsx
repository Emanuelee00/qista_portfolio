import { useState, useEffect } from 'react'

export default function INatObservations({ lat, lon, regionName }) {
  const [obs, setObs] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!lat || !lon) return
    setLoading(true)
    setObs(null)
    fetch(`https://api.inaturalist.org/v1/observations?taxon_id=48738&lat=${lat}&lng=${lon}&radius=50&per_page=6&order_by=observed_on&order=desc&quality_grade=research&photos=true`)
      .then(r => r.json())
      .then(data => {
        const results = (data.results || []).map(o => ({
          id: o.id,
          species: o.taxon?.preferred_common_name || o.taxon?.name || 'Moustique',
          scientific: o.taxon?.name || '',
          photo: o.photos?.[0]?.url?.replace('square', 'small'),
          date: o.observed_on,
          place: o.place_guess,
          user: o.user?.login,
        })).filter(o => o.photo)
        setObs(results)
      })
      .catch(() => setObs([]))
      .finally(() => setLoading(false))
  }, [lat, lon])

  if (loading) return (
    <div className="inat-section">
      <div className="section-label">Observations recentes (iNaturalist)</div>
      <div className="inat-loading"><div className="loader" /> Recherche...</div>
    </div>
  )

  if (!obs || obs.length === 0) return null

  return (
    <div className="inat-section">
      <div className="section-label">Observations recentes pres de {regionName}</div>
      <div className="inat-grid">
        {obs.map(o => (
          <a key={o.id} className="inat-card" href={`https://www.inaturalist.org/observations/${o.id}`} target="_blank" rel="noopener noreferrer">
            <img src={o.photo} alt={o.species} className="inat-photo" />
            <div className="inat-info">
              <span className="inat-species">{o.species}</span>
              <span className="inat-sci">{o.scientific}</span>
              <span className="inat-date">{o.date} — {o.place?.slice(0, 30)}</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
