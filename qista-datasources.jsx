import { useState } from "react";

const DATA_SOURCES = [
  {
    category: "🦟 Distribution & Présence des moustiques",
    color: "#e74c3c",
    sources: [
      {
        name: "ECDC Mosquito Maps",
        description: "Cartes de distribution des Aedes (albopictus, aegypti, japonicus, koreicus, atropalpus) par région NUTS3. Mise à jour annuelle (dernière : juin 2025). 369 régions avec Ae. albopictus établi.",
        format: "PNG + données structurées par région",
        access: "Téléchargement direct, pas d'API",
        url: "https://www.ecdc.europa.eu/en/disease-vectors/surveillance-and-disease-data/mosquito-maps",
        priority: "ESSENTIEL",
        effort: "Faible — scraping des cartes + structuration manuelle en JSON",
      },
      {
        name: "VectorNet (ECDC/EFSA) via GBIF",
        description: "Base de données officielle de 277 353 observations de vecteurs (moustiques, tiques, phlébotomes) en Europe. Données géolocalisées avec espèces identifiées.",
        format: "Darwin Core Archive (CSV/ZIP)",
        access: "Téléchargement via GBIF — DOI: 10.15468/f3k8r9",
        url: "https://www.gbif.org/dataset/4abd984b-122c-44a0-8c92-b37e2f5299b1",
        priority: "ESSENTIEL",
        effort: "Faible — download direct, format standard",
      },
      {
        name: "Mosquito Alert (Citizen Science)",
        description: "Observations citoyennes géolocalisées avec photos validées par des entomologistes. 5 espèces cibles. Couverture principale : Espagne, Pays-Bas, Italie, Hongrie. Depuis 2014.",
        format: "JSON/CSV via GitHub + Zenodo",
        access: "GitHub: github.com/MosquitoAlert/Data (MAJ quotidienne) ou Zenodo DOI: 10.5281/zenodo.597466",
        url: "https://github.com/mosquitoalert/data",
        priority: "IMPORTANT",
        effort: "Faible — repo GitHub, prêt à l'emploi",
      },
      {
        name: "GBIF — Occurrences Culicidae Europe",
        description: "Agrégateur mondial de données de biodiversité. Toutes les observations de moustiques (famille Culicidae) en Europe. Inclut données musées, recherche, surveillance.",
        format: "CSV / Darwin Core Archive",
        access: "API REST + téléchargement (compte gratuit requis)",
        url: "https://www.gbif.org/occurrence/search?taxon_key=5765",
        priority: "BONUS",
        effort: "Moyen — nécessite filtrage et nettoyage",
      },
      {
        name: "AIMSurv (AIM-COST Action)",
        description: "Surveillance harmonisée des Aedes invasifs en Europe. Programme de surveillance coordonné multi-pays.",
        format: "CSV via GBIF",
        access: "Téléchargement GBIF — DOI: 10.15470/vs3677",
        url: "https://www.gbif.org/dataset/3991e23f-c0c4-4548-a2ae-7b21b3a4703e",
        priority: "BONUS",
        effort: "Faible",
      },
    ],
  },
  {
    category: "🌡️ Météo & Climat",
    color: "#3498db",
    sources: [
      {
        name: "Open-Meteo API",
        description: "API météo gratuite, sans clé. Température, humidité, précipitations, vent. Historique depuis 1940 (ERA5). Prévisions 16 jours. Résolution 1-2km en Europe.",
        format: "JSON API REST",
        access: "100% gratuit, sans inscription, CORS supporté, <10ms de latence",
        url: "https://open-meteo.com/en/docs",
        priority: "ESSENTIEL",
        effort: "Très faible — appel API direct depuis le frontend React",
        examples: [
          "Forecast: api.open-meteo.com/v1/forecast?latitude=43.3&longitude=5.4&hourly=temperature_2m,relative_humidity_2m,precipitation",
          "Historique: api.open-meteo.com/v1/archive?latitude=43.3&longitude=5.4&start_date=2024-06-01&end_date=2024-09-30&hourly=temperature_2m,relative_humidity_2m",
        ],
      },
      {
        name: "Open-Meteo Climate API (IPCC)",
        description: "Projections climatiques CMIP6 de 1950 à 2050. Permet de modéliser l'évolution future du risque moustique avec le changement climatique.",
        format: "JSON API REST",
        access: "Gratuit, sans clé",
        url: "https://open-meteo.com/en/docs/climate-api",
        priority: "BONUS pour le pitch",
        effort: "Faible",
      },
    ],
  },
  {
    category: "🏥 Maladies vectorielles",
    color: "#e67e22",
    sources: [
      {
        name: "ECDC — West Nile Virus Surveillance",
        description: "Cas humains de WNV par région NUTS3, mis à jour chaque semaine pendant la saison (juin-nov). Dataset CSV téléchargeable. 2024 : 1 436 cas dans 19 pays européens.",
        format: "CSV téléchargeable",
        access: "Téléchargement direct",
        url: "https://wnv-weekly.ecdc.europa.eu/",
        priority: "ESSENTIEL",
        effort: "Très faible — CSV prêt à l'emploi",
      },
      {
        name: "ECDC — Dengue (cas voyageurs + autochtones)",
        description: "Cas de dengue déclarés dans l'UE/EEE, incluant les cas autochtones en Europe continentale (en hausse). CSV avec lieu d'infection.",
        format: "CSV",
        access: "Téléchargement direct",
        url: "https://www.ecdc.europa.eu/en/dengue-fever/surveillance-and-disease-data",
        priority: "ESSENTIEL",
        effort: "Très faible",
      },
      {
        name: "ECDC Surveillance Atlas",
        description: "Atlas interactif couvrant toutes les maladies à déclaration obligatoire dans l'UE : WNV, dengue, chikungunya, malaria. Export de données possible.",
        format: "Interface web + export CSV",
        access: "Gratuit, interface en ligne",
        url: "https://atlas.ecdc.europa.eu/public/",
        priority: "IMPORTANT",
        effort: "Moyen — extraction manuelle via l'interface",
      },
      {
        name: "ECDC/EFSA — Rapports mensuels WNV",
        description: "Rapports conjoints ECDC/EFSA intégrant cas humains + foyers chez les équidés et oiseaux. Vision One Health du risque.",
        format: "PDF + données",
        access: "Publication mensuelle",
        url: "https://www.efsa.europa.eu/en/topics/topic/vector-borne-diseases",
        priority: "BONUS",
        effort: "Moyen — extraction depuis PDF",
      },
    ],
  },
  {
    category: "🗺️ Géographie & Environnement",
    color: "#27ae60",
    sources: [
      {
        name: "Copernicus Water Bodies",
        description: "Étendue des surfaces en eau (mares, lacs, rivières) à 100m et 300m de résolution. Mensuel. Clé pour identifier les gîtes larvaires potentiels.",
        format: "Raster GeoTIFF via OData API",
        access: "Gratuit via Copernicus Data Space Ecosystem (CDSE)",
        url: "https://land.copernicus.eu/en/products/water-bodies",
        priority: "IMPORTANT",
        effort: "Élevé — données raster, nécessite traitement SIG",
      },
      {
        name: "Copernicus Land Cover (10m)",
        description: "Couverture des sols à 10m : zones urbaines, forêts, cultures, zones humides. Permet de qualifier le type d'environnement par zone.",
        format: "Raster GeoTIFF",
        access: "Gratuit via CDSE",
        url: "https://land.copernicus.eu/en/products/global-dynamic-land-cover",
        priority: "BONUS",
        effort: "Élevé",
      },
      {
        name: "Copernicus Water & Wetness (Europe)",
        description: "Carte haute résolution des zones humides en Europe à 10m. Idéal pour localiser les habitats favorables aux moustiques.",
        format: "Raster 10m, tuiles 100x100km par pays",
        access: "Téléchargement + CLMS API",
        url: "https://land.copernicus.eu/en/products/high-resolution-layer-water-and-wetness",
        priority: "BONUS",
        effort: "Élevé",
      },
    ],
  },
  {
    category: "📊 Données socio-économiques",
    color: "#9b59b6",
    sources: [
      {
        name: "Eurostat — Densité de population NUTS3",
        description: "Population et densité par région NUTS3 dans toute l'UE. Permet de pondérer le risque par population exposée.",
        format: "JSON-stat via API REST",
        access: "API gratuite, sans clé. Dataset: DEMO_R_D3DENS",
        url: "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/DEMO_R_D3DENS?lang=EN",
        priority: "IMPORTANT",
        effort: "Faible — API directe",
      },
      {
        name: "Eurostat — Tourisme régional",
        description: "Nuitées touristiques par région NUTS2. Permet d'estimer l'impact économique du moustique sur le tourisme.",
        format: "JSON-stat via API REST",
        access: "API gratuite. Dataset: TOUR_OCC_NIN2",
        url: "https://ec.europa.eu/eurostat/databrowser/view/tour_occ_nin2/default/table?lang=en",
        priority: "IMPORTANT pour le business case",
        effort: "Faible",
      },
      {
        name: "NUTS GeoJSON Boundaries",
        description: "Contours géographiques des régions NUTS 1/2/3 en GeoJSON pour afficher la carte.",
        format: "GeoJSON / TopoJSON",
        access: "Eurostat GISCO + GitHub repos communautaires",
        url: "https://ec.europa.eu/eurostat/web/gisco/geodata/statistical-units/territorial-units-statistics",
        priority: "ESSENTIEL pour le proto",
        effort: "Très faible — GeoJSON prêt à l'emploi",
      },
    ],
  },
  {
    category: "🔬 Recherche & Modèles",
    color: "#1abc9c",
    sources: [
      {
        name: "VectorByte",
        description: "Écosystème de données vectorielles : traits biologiques des moustiques (durée de vie, taux de reproduction selon température). Utile pour calibrer le modèle de risque.",
        format: "Divers (API + téléchargement)",
        access: "Open access",
        url: "https://www.vectorbyte.org/vecdataecosystem",
        priority: "BONUS",
        effort: "Moyen",
      },
      {
        name: "Mosquito Alert — Modèles bayésiens",
        description: "Estimations de probabilité de présence par espèce, basées sur les observations citoyennes + effort d'échantillonnage. Cartes raster mises à jour hebdomadairement.",
        format: "JSON via Data Portal",
        access: "Open access",
        url: "https://labs.mosquitoalert.com/metadata_public_portal/",
        priority: "BONUS pour la crédibilité scientifique",
        effort: "Moyen",
      },
    ],
  },
];

const PRIORITY_COLORS = {
  ESSENTIEL: { bg: "#e74c3c", text: "#fff" },
  IMPORTANT: { bg: "#f39c12", text: "#fff" },
  "IMPORTANT pour le pitch": { bg: "#f39c12", text: "#fff" },
  "IMPORTANT pour le business case": { bg: "#f39c12", text: "#fff" },
  "ESSENTIEL pour le proto": { bg: "#e74c3c", text: "#fff" },
  BONUS: { bg: "#95a5a6", text: "#fff" },
  "BONUS pour le pitch": { bg: "#95a5a6", text: "#fff" },
  "BONUS pour la crédibilité scientifique": { bg: "#95a5a6", text: "#fff" },
};

const EFFORT_ICONS = {
  "Très faible": "⚡",
  Faible: "✅",
  "Faible — scraping des cartes + structuration manuelle en JSON": "✅",
  "Faible — download direct, format standard": "✅",
  "Faible — repo GitHub, prêt à l'emploi": "✅",
  "Faible — API directe": "✅",
  "Très faible — CSV prêt à l'emploi": "⚡",
  "Très faible — appel API direct depuis le frontend React": "⚡",
  "Très faible — GeoJSON prêt à l'emploi": "⚡",
  Moyen: "⚙️",
  "Moyen — nécessite filtrage et nettoyage": "⚙️",
  "Moyen — extraction manuelle via l'interface": "⚙️",
  "Moyen — extraction depuis PDF": "⚙️",
  Élevé: "🔧",
  "Élevé — données raster, nécessite traitement SIG": "🔧",
};

function SourceCard({ source }) {
  const [expanded, setExpanded] = useState(false);
  const priorityStyle = PRIORITY_COLORS[source.priority] || { bg: "#bdc3c7", text: "#fff" };
  const effortIcon = Object.entries(EFFORT_ICONS).find(([k]) => source.effort.startsWith(k) || source.effort === k)?.[1] || "⚙️";

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        background: "var(--bg-card, #fff)",
        border: "1px solid var(--border, #e0e0e0)",
        borderRadius: 10,
        padding: "14px 16px",
        marginBottom: 10,
        cursor: "pointer",
        transition: "all 0.2s",
        boxShadow: expanded ? "0 2px 12px rgba(0,0,0,0.08)" : "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary, #1a1a1a)" }}>{source.name}</span>
            <span
              style={{
                background: priorityStyle.bg,
                color: priorityStyle.text,
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 4,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              {source.priority}
            </span>
            <span style={{ fontSize: 12, color: "var(--text-muted, #888)" }}>
              {effortIcon} {source.effort.split("—")[0].trim()}
            </span>
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-secondary, #555)", lineHeight: 1.5 }}>
            {source.description}
          </p>
        </div>
        <span style={{ fontSize: 18, color: "var(--text-muted, #999)", flexShrink: 0, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
      </div>

      {expanded && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border, #eee)" }}>
          <div style={{ display: "grid", gap: 8, fontSize: 13 }}>
            <div>
              <strong style={{ color: "var(--text-muted, #888)" }}>Format :</strong>{" "}
              <span style={{ color: "var(--text-primary, #333)" }}>{source.format}</span>
            </div>
            <div>
              <strong style={{ color: "var(--text-muted, #888)" }}>Accès :</strong>{" "}
              <span style={{ color: "var(--text-primary, #333)" }}>{source.access}</span>
            </div>
            <div>
              <strong style={{ color: "var(--text-muted, #888)" }}>Effort intégration :</strong>{" "}
              <span style={{ color: "var(--text-primary, #333)" }}>{source.effort}</span>
            </div>
            <div>
              <strong style={{ color: "var(--text-muted, #888)" }}>URL :</strong>{" "}
              <a href={source.url} target="_blank" rel="noopener noreferrer" style={{ color: "#3498db", wordBreak: "break-all" }}>
                {source.url}
              </a>
            </div>
            {source.examples && (
              <div>
                <strong style={{ color: "var(--text-muted, #888)" }}>Exemples d'appels :</strong>
                {source.examples.map((ex, i) => (
                  <div key={i} style={{ background: "var(--bg-code, #f5f5f5)", padding: "6px 10px", borderRadius: 6, marginTop: 4, fontFamily: "monospace", fontSize: 11, wordBreak: "break-all", color: "var(--text-primary, #333)" }}>
                    {ex}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [filter, setFilter] = useState("all");

  const essentialCount = DATA_SOURCES.flatMap((c) => c.sources).filter((s) => s.priority.includes("ESSENTIEL")).length;
  const totalCount = DATA_SOURCES.flatMap((c) => c.sources).length;

  return (
    <div style={{ fontFamily: "'Segoe UI', -apple-system, sans-serif", maxWidth: 780, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px", color: "var(--text-primary, #1a1a1a)" }}>
          🦟 Qista MosqRisk — Sources de données
        </h1>
        <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--text-secondary, #666)" }}>
          {totalCount} sources identifiées dont {essentialCount} essentielles pour le MVP
        </p>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["all", "ESSENTIEL", "IMPORTANT", "BONUS"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                border: "none",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                background: filter === f ? "var(--text-primary, #1a1a1a)" : "var(--bg-card, #f0f0f0)",
                color: filter === f ? "var(--bg-card, #fff)" : "var(--text-secondary, #666)",
                transition: "all 0.15s",
              }}
            >
              {f === "all" ? `Toutes (${totalCount})` : f}
            </button>
          ))}
        </div>
      </div>

      {DATA_SOURCES.map((category) => {
        const filtered = category.sources.filter((s) => filter === "all" || s.priority.includes(filter));
        if (filtered.length === 0) return null;

        return (
          <div key={category.category} style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px", color: category.color, display: "flex", alignItems: "center", gap: 8 }}>
              {category.category}
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted, #999)" }}>({filtered.length})</span>
            </h2>
            {filtered.map((source) => (
              <SourceCard key={source.name} source={source} />
            ))}
          </div>
        );
      })}

      <div style={{ marginTop: 32, padding: 16, background: "var(--bg-card, #f8f9fa)", borderRadius: 10, border: "1px solid var(--border, #e0e0e0)" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: "var(--text-primary, #1a1a1a)" }}>⚡ Stack recommandée pour le proto rapide</h3>
        <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-secondary, #555)" }}>
          <strong>Frontend :</strong> React + Leaflet/Mapbox pour la carte + Recharts pour les graphes<br />
          <strong>Données live :</strong> Open-Meteo API (appel direct depuis le browser, 0 backend)<br />
          <strong>Données statiques :</strong> ECDC CSV (WNV + distribution) + NUTS3 GeoJSON → embarqués en JSON dans l'app<br />
          <strong>Citizen data :</strong> Mosquito Alert GitHub → pré-traité en JSON<br />
          <strong>Score :</strong> Calcul client-side, pas besoin de serveur
        </div>
      </div>
    </div>
  );
}
