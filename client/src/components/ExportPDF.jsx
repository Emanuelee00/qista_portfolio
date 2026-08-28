const RISK_COLORS = { E: '#FF4D4D', D: '#FF8C42', C: '#FFD93D', B: '#6BCB77', A: '#3DA35D' }
const RISK_LABELS = { E: 'Critique', D: 'Eleve', C: 'Modere', B: 'Faible', A: 'Tres faible' }

export default function ExportPDF({ nutsId, data }) {
  if (!nutsId || !data) return null

  function generateReport() {
    const w = data.w || 0
    const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>Rapport MosqRisk — ${data.name}</title>
<style>
  body{font-family:Helvetica,Arial,sans-serif;max-width:700px;margin:40px auto;color:#333;line-height:1.6}
  h1{color:#443F3D;border-bottom:3px solid #a3e5d3;padding-bottom:10px}
  h2{color:#443F3D;margin-top:30px}
  .score-big{font-size:48px;font-weight:700;color:${RISK_COLORS[data.risk_class]}}
  .badge{display:inline-block;padding:4px 16px;border-radius:6px;color:#fff;font-weight:700;font-size:18px;background:${RISK_COLORS[data.risk_class]}}
  table{width:100%;border-collapse:collapse;margin:16px 0}
  th,td{padding:10px 14px;text-align:left;border-bottom:1px solid #eee}
  th{background:#f7f7f7;font-weight:600}
  .bar{height:12px;border-radius:6px;display:inline-block}
  .footer{margin-top:40px;padding-top:16px;border-top:1px solid #eee;color:#999;font-size:12px}
  .reco{background:#f0faf0;border-left:4px solid #a3e5d3;padding:16px;margin:16px 0;border-radius:4px}
</style>
</head><body>
<h1>Rapport de risque moustique — ${data.name}</h1>
<p>Region NUTS3 : ${nutsId} | Pays : ${data.country} | Coordonnees : ${data.lat}, ${data.lon}</p>

<h2>Score global</h2>
<p><span class="score-big">${data.total}</span> /100 — <span class="badge">${data.risk_class} - ${RISK_LABELS[data.risk_class]}</span></p>

<h2>Detail par dimension</h2>
<table>
<tr><th>Dimension</th><th>Score</th><th>Max</th><th>%</th></tr>
<tr><td>S — Especes presentes</td><td>${data.s}</td><td>22</td><td>${Math.round(data.s/22*100)}%</td></tr>
<tr><td>C — Favorabilite climatique</td><td>${data.c}</td><td>22</td><td>${Math.round(data.c/22*100)}%</td></tr>
<tr><td>D — Maladies vectorielles</td><td>${data.d}</td><td>22</td><td>${Math.round(data.d/22*100)}%</td></tr>
<tr><td>O — Observations citoyennes</td><td>${data.o}</td><td>19</td><td>${Math.round(data.o/19*100)}%</td></tr>
<tr><td>W — Zones humides / eau</td><td>${w}</td><td>15</td><td>${Math.round(w/15*100)}%</td></tr>
</table>

<h2>Donnees complementaires</h2>
<table>
<tr><td>Observations GBIF (Ae. albopictus)</td><td>${data.gbif_obs || 0}</td></tr>
<tr><td>Signalements Mosquito Alert</td><td>${data.ma_obs || 0}</td></tr>
<tr><td>Densite de population</td><td>${data.density ? data.density + ' hab/km2' : 'N/A'}</td></tr>
<tr><td>Surface en eau</td><td>${data.water_pct ? data.water_pct + '%' : 'N/A'}</td></tr>
</table>

<h2>Recommandations</h2>
<div class="reco">
${data.risk_class === 'E' || data.risk_class === 'D' ? `
<p><strong>Action immediate recommandee.</strong> Cette zone presente un risque ${RISK_LABELS[data.risk_class].toLowerCase()} de nuisance et de transmission de maladies vectorielles.</p>
<p>Solutions recommandees :</p>
<ul>
<li>Installation de bornes anti-moustiques ecologiques (technologie Qista — CO2 recycle, 0 insecticide)</li>
<li>Rayon d'action : 60m par borne, couverture possible de ${Math.round(Math.PI*60*60)} m2 par unite</li>
<li>Reduction attendue : 85-93% de la population de moustiques dans le rayon d'action</li>
</ul>
` : `
<p>Cette zone presente un risque ${RISK_LABELS[data.risk_class].toLowerCase()}. Surveillance continue recommandee.</p>
<p>En cas d'augmentation du score (passage en classe C ou superieur), envisager l'installation de solutions de demoustication ecologique.</p>
`}
</div>

<h2>Sources de donnees</h2>
<p>GBIF (Aedes albopictus), Mosquito Alert, ECDC Surveillance Atlas (WNV, Dengue, Chikungunya), Open-Meteo (climat), GLWD (zones humides), Eurostat (population), WHO ARBOV (dengue mondial).</p>

<div class="footer">
<p>Rapport genere automatiquement par la plateforme MosqRisk — Qista</p>
<p>Date : ${new Date().toLocaleDateString('fr-FR')} | Donnees de reference : ete 2024</p>
</div>
</body></html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank')
    // Auto-trigger print dialog for PDF
    setTimeout(() => { if (win) win.print() }, 500)
  }

  return (
    <button className="export-btn" onClick={generateReport}>
      Generer le rapport PDF
    </button>
  )
}
