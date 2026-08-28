# Statut des sources de donnees - MosqRisk

> Teste le 1er avril 2026. Rapport complet de chaque source.

---

## Resume rapide

| # | Source | Statut | Utilisable pour le proto ? |
|---|--------|--------|---------------------------|
| 1 | Open-Meteo Forecast | ✅ | OUI - Score Climat (C) |
| 2 | Open-Meteo Archive | ✅ | OUI - Score Climat historique |
| 3 | ECDC WNV Surveillance | ✅ | OUI - API REST Atlas + CSV telecharge (3915 lignes) |
| 4 | ECDC Dengue Surveillance | ✅ | OUI - API REST Atlas + CSV telecharge (5201 lignes) |
| 4b | ECDC Chikungunya | ✅ | OUI - API REST Atlas + CSV telecharge (4911 lignes) |
| 4c | ECDC Malaria | ✅ | OUI - API REST Atlas + CSV telecharge (3435 lignes) |
| 5 | VectorNet (GBIF) | ✅ | OUI - Score Espece (S) — 120k records, API REST |
| 6 | Mosquito Alert | ✅ | OUI - Score Observations (O) — ZIP 61 Mo sur GitHub |
| 7 | Eurostat Population NUTS3 | ✅ | OUI - Ponderation du risque |
| 8 | NUTS3 GeoJSON | ✅ | OUI - Carte du proto |
| 9 | GBIF Aedes albopictus | ✅ | OUI - Score Espece (S) — 28k+ records en Europe |
| 10 | ECDC Mosquito Maps | ⚠️ | PARTIEL - PNG seulement, pas de data structuree |
| 11 | Eurostat Tourisme | ✅ | OUI - Business case |
| 12 | ECDC Surveillance Atlas | ✅ | OUI - Export CSV possible (WNV, dengue, chikungunya) |
| 13 | Open-Meteo Climate CMIP6 | ✅ | OUI - Projections futures pour le pitch |
| 14 | Mosquito Alert Models | ❌ | NON - portail vide/inaccessible |

---

## PRIORITE 1 — ESSENTIELLES

### 1. Open-Meteo API — Forecast ✅

- **URL** : `https://api.open-meteo.com/v1/forecast`
- **Statut** : FONCTIONNE PARFAITEMENT
- **Cle API** : Aucune
- **Format** : JSON
- **Latence** : < 50ms
- **Variables testees** : temperature_2m, relative_humidity_2m, precipitation
- **Couverture** : Mondiale, resolution 1-2km en Europe
- **Previsions** : Jusqu'a 16 jours
- **Exemple teste (Marseille)** :
  - 2026-04-01T00:00 → 9.6C, 29% humidite, 0mm precip
  - 72 points horaires pour 3 jours
- **Verdict** : Source ideale pour le Score Climat (C). Zero friction, appel direct depuis le frontend.

### 2. Open-Meteo API — Archive ✅

- **URL** : `https://archive-api.open-meteo.com/v1/archive`
- **Statut** : FONCTIONNE (attention : le domaine est `archive-api.open-meteo.com`, PAS `api.open-meteo.com/v1/archive`)
- **Format** : JSON identique au forecast
- **Donnees testees** : Juillet 2024, Marseille — max 28.4C, min 18.1C
- **Variables** : temperature_2m_max, temperature_2m_min, precipitation_sum (daily)
- **Historique** : Depuis 1940 (ERA5 reanalysis)
- **Verdict** : Parfait pour calculer les moyennes climatiques estivales par zone.

### 3. ECDC — West Nile Virus Surveillance ✅ (API REST DECOUVERTE)

- **API REST** : `https://atlas.ecdc.europa.eu/public/AtlasService/rest/GetMeasuresResultsExportFile?healthTopicId=60&datasetId=27&measureTypes=I,Q&geoLevel=2&timeUnit=Year`
- **Statut** : FONCTIONNE — CSV telecharge automatiquement
- **Fichier local** : `data/ecdc/wnv_cases_europe.csv` (3 915 lignes)
- **Colonnes** : HealthTopic, Population, Indicator, Unit, Time, RegionCode, RegionName, NumValue, TxtValue
- **Indicateurs** : Reported cases (N), Notification rate (N/100000), Age standardised rate
- **Sous-indicateurs** : ALL (total) + DOMESTIC (autochtones) + IMPORTED
- **Periode** : 2008-2024
- **Granularite** : Par pays (30+ pays EU/EEA)
- **Donnees 2024** : Albanie 3.71/100k, Grece 1.71/100k, Hongrie 1.03/100k, Serbie 0.93/100k
- **Pic historique** : 2018 (Serbie 5.23/100k, EU-wide 0.32/100k)
- **Health Topic ID** : 60 (WNF)
- **Verdict** : EXCELLENTE SOURCE. Donnees completes, API programmatique, CSV propre.

### 4. ECDC — Dengue Surveillance ✅ (API REST DECOUVERTE)

- **API REST** : `https://atlas.ecdc.europa.eu/public/AtlasService/rest/GetMeasuresResultsExportFile?healthTopicId=16&datasetId=27&measureTypes=I,Q&geoLevel=2&timeUnit=Year`
- **Statut** : FONCTIONNE — CSV telecharge automatiquement
- **Fichier local** : `data/ecdc/dengue_cases_europe.csv` (5 201 lignes)
- **Colonnes** : Identiques au WNV
- **Indicateurs** : Reported cases, Notification rate, Age standardised rate, Completeness
- **Sous-indicateurs** : ALL + DOMESTIC + IMPORTED (distinction cas autochtones/importes)
- **Periode** : 2008-2024
- **Donnees 2024** : France 7.15/100k (!), Luxembourg 3.80/100k, Danemark 2.84/100k
- **Health Topic ID** : 16 (DENGUE)
- **Verdict** : EXCELLENTE SOURCE. Tendance a la hausse nette depuis 2020.

### 4b. ECDC — Chikungunya Surveillance ✅ (API REST DECOUVERTE)

- **API REST** : `https://atlas.ecdc.europa.eu/public/AtlasService/rest/GetMeasuresResultsExportFile?healthTopicId=11&datasetId=27&measureTypes=I,Q&geoLevel=2&timeUnit=Year`
- **Statut** : FONCTIONNE
- **Fichier local** : `data/ecdc/chikungunya_cases_europe.csv` (4 911 lignes)
- **Periode** : 2008-2024
- **Health Topic ID** : 11 (CHIK)

### 4c. ECDC — Malaria Surveillance ✅ (API REST DECOUVERTE)

- **API REST** : `https://atlas.ecdc.europa.eu/public/AtlasService/rest/GetMeasuresResultsExportFile?healthTopicId=34&datasetId=27&measureTypes=I,Q&geoLevel=2&timeUnit=Year`
- **Statut** : FONCTIONNE
- **Fichier local** : `data/ecdc/malaria_cases_europe.csv` (3 435 lignes)
- **Periode** : 2003-2024
- **Health Topic ID** : 34 (MALA)

### 5. VectorNet (ECDC/EFSA) via GBIF ✅

- **URL API** : `https://api.gbif.org/v1/occurrence/search?datasetKey=4abd984b-122c-44a0-8c92-b37e2f5299b1`
- **Statut** : FONCTIONNE
- **Total records** : 120 158 observations
- **Format** : JSON via API REST, pagination supportee (offset/limit)
- **Especes testees** : 20 442 records pour le genre Aedes (q=Aedes)
- **Champs disponibles** : species, genus, family, country, decimalLatitude, decimalLongitude, eventDate, lifeStage, individualCount, samplingProtocol
- **Attention** : Le filtre `taxonKey=5765` (Culicidae) retourne 0 — utiliser `q=Aedes` ou filtrer par genre
- **Licence** : CC BY 4.0
- **Exemple** : Aedes japonicus en Pologne (49.87N, 19.49E), larve, 25 individus
- **Verdict** : Excellente source pour le Score Espece (S). Necessite un peu de travail de filtrage.

### 6. Mosquito Alert — Donnees citoyennes ✅

- **URL** : `https://github.com/mosquitoalert/data`
- **Statut** : FONCTIONNE
- **Contenu du repo** :
  - `all_reports.zip` — 61.5 Mo (dataset principal)
  - `translation_dict.json` — 54 Ko (dictionnaire de traduction)
  - `README.md` + `LICENSE.md`
- **Format** : ZIP contenant les reports (probablement CSV/JSON)
- **Licence** : Licence ouverte
- **Couverture** : Espagne, Pays-Bas, Italie, Hongrie principalement
- **Especes** : Ae. albopictus, Ae. aegypti, Ae. japonicus, Ae. koreicus, Culex pipiens
- **Verdict** : Telecharger le ZIP, extraire et analyser. Source cle pour le Score Observations (O).

### 7. Eurostat — Population NUTS3 ✅

- **URL API** : `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/DEMO_R_D3DENS`
- **Statut** : FONCTIONNE PARFAITEMENT
- **Format** : JSON-stat
- **Cle API** : Aucune
- **Filtrage** : Par code NUTS3 (`&geo=FR101`) et annee (`&time=2023`)
- **Donnees testees** :
  - Paris (FR101) : 20 211.7 hab/km2
  - Barcelona (ES511) : 756.6 hab/km2
  - Roma (ITI43) : 800.4 hab/km2
  - Athenes centre (EL303) : 11 265.3 hab/km2
  - Seine-et-Marne (FR102) : 249.6 hab/km2
- **Derniere MAJ** : 25 fevrier 2026
- **Verdict** : Parfait pour ponderer le score par population exposee.

### 8. NUTS3 GeoJSON Boundaries ✅

- **URL** : `https://gisco-services.ec.europa.eu/distribution/v2/nuts/geojson/NUTS_RG_20M_2024_4326_LEVL_3.geojson`
- **Statut** : FONCTIONNE PARFAITEMENT
- **Format** : GeoJSON (FeatureCollection)
- **Resolution** : 20M (simplifie, adapte au web)
- **Projection** : EPSG:4326 (WGS84)
- **Annee** : 2024
- **Proprietes par feature** : NUTS_ID, LEVL_CODE, CNTR_CODE, NAME_LATN, NUTS_NAME, MOUNT_TYPE, URBN_TYPE, COAST_TYPE
- **Geometrie** : Polygon / MultiPolygon
- **Centaines de features** couvrant toute l'Europe
- **Verdict** : ESSENTIEL pour le proto. Fichier pret a l'emploi avec Leaflet/Mapbox.

---

## PRIORITE 2 — IMPORTANTS

### 9. ECDC Mosquito Distribution Maps ⚠️

- **URL** : `https://www.ecdc.europa.eu/en/disease-vectors/surveillance-and-disease-data/mosquito-maps`
- **Statut** : PNG UNIQUEMENT, pas de donnees structurees
- **Especes couvertes** : Ae. albopictus, Ae. aegypti, Ae. japonicus, Ae. atropalpus, Ae. koreicus
- **Granularite** : NUTS3
- **Probleme** : Les cartes sont des images PNG. Aucun fichier CSV/JSON telechargeable derriere.
- **Contournement possible** : Structurer manuellement les donnees par region a partir des cartes, OU utiliser les donnees GBIF/VectorNet comme proxy.
- **Verdict** : Ne pas perdre de temps sur le scraping. Utiliser GBIF a la place.

### 10. Eurostat — Tourisme regional ✅

- **URL API** : `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/TOUR_OCC_NIN2`
- **Statut** : FONCTIONNE PARFAITEMENT
- **Format** : JSON-stat (SDMX v2.0)
- **Donnees testees (2023)** :
  - Cataluna (ES51) : 85 635 851 nuitees
  - Ile-de-France (FR10) : 85 162 673 nuitees
  - Lazio (ITI4) : 45 727 169 nuitees
- **Granularite** : NUTS2 (pas NUTS3)
- **Derniere MAJ** : 20 mars 2026
- **Verdict** : Excellent pour le business case (impact tourisme). Granularite NUTS2 suffisante.

### 11. ECDC Surveillance Atlas — API REST ✅✅✅

- **BASE URL** : `https://atlas.ecdc.europa.eu/public/AtlasService/rest/`
- **Doc API** : `https://atlas.ecdc.europa.eu/public/AtlasService/rest/help`
- **Statut** : API REST COMPLETE DECOUVERTE — 30+ endpoints
- **Aucune cle API requise**

#### Endpoints cles decouverts :

| Endpoint | Description |
|----------|-------------|
| `/GetHealthTopics` | Liste tous les topics (79 maladies) |
| `/GetDatasetsForHealthTopic?healthTopicId=X` | Datasets par maladie |
| `/GetIndicatorMeasuresForHealthTopicAndDataset?healthTopicId=X&datasetId=27` | Indicateurs disponibles |
| `/GetMeasuresResultsExportFile?healthTopicId=X&datasetId=27&measureTypes=I,Q&geoLevel=2&timeUnit=Year` | **EXPORT CSV COMPLET** |
| `/GetRegions?geoCodes=X` | Regions geographiques |
| `/GetTimePeriods?timeCodes=X` | Periodes disponibles |

#### Health Topic IDs pour MosqRisk :

| Maladie | ID | Dataset ID | Lignes CSV |
|---------|-----|-----------|------------|
| West Nile Virus | 60 | 27 | 3 915 |
| Dengue | 16 | 27 | 5 201 |
| Chikungunya | 11 | 27 | 4 911 |
| Malaria | 34 | 27 | 3 435 |
| **TOTAL** | | | **17 462** |

#### Structure CSV :
```
"HealthTopic","Population","Indicator","Unit","Time","RegionCode","RegionName","NumValue","TxtValue"
```

#### Indicateurs par maladie (WNV exemple) :
- `ALL.COUNT` — Nombre de cas declares
- `ALL.RATE` — Taux de notification /100k
- `ALL.AGESTANDARDISED.RATE` — Taux standardise par age
- `ALL.DOMESTIC.COUNT` — Cas autochtones
- `ALL.DOMESTIC.RATE` — Taux autochtones /100k
- `ALL.IMPORTED.COUNT` — Cas importes (dengue, chikungunya)

- **Verdict** : **DECOUVERTE MAJEURE**. API REST complete, 0 authentification, donnees CSV structurees pour 79 maladies. Source definitive pour le Score Maladie (D).

---

## PRIORITE 3 — BONUS

### 12. GBIF — Aedes albopictus (toutes sources) ✅

- **URL API** : `https://api.gbif.org/v1/occurrence/search?speciesKey=1651430`
- **Statut** : FONCTIONNE TRES BIEN
- **speciesKey** : 1651430 (Aedes albopictus, Skuse 1894)
- **Records par pays** :
  - Espagne : 18 569
  - Italie : 6 799
  - France : 2 520
  - Grece : 839
- **Source principale** : iNaturalist research-grade observations
- **Champs** : species, decimalLatitude, decimalLongitude, eventDate, stateProvince
- **Verdict** : Meilleure source pour la distribution geographique d'Ae. albopictus. Couvre toute l'Europe avec des milliers d'observations geolocalisees.

### 13. Open-Meteo Climate API (CMIP6) ✅

- **URL** : `https://climate-api.open-meteo.com/v1/climate`
- **Statut** : FONCTIONNE
- **Modele teste** : EC_Earth3P_HR
- **Donnees** : 365 points par an, projections temperature max
- **Periode** : 1950 a 2050
- **Verdict** : Parfait pour un slide "projection future du risque" dans le pitch.

### 14. Mosquito Alert — Modeles bayesiens ❌

- **URL** : `https://labs.mosquitoalert.com/metadata_public_portal/`
- **Statut** : Page vide / contenu inaccessible
- **Verdict** : Non exploitable. Ne pas investir de temps.

### 15. GBIF — Culicidae generique (taxonKey=5765)

- **URL** : `https://api.gbif.org/v1/occurrence/search?taxonKey=5765`
- **Statut** : Retourne 1 074 records mais ce sont des isopodes (Trachelipus rathkii), PAS des moustiques
- **Probleme** : Le taxonKey 5765 ne correspond pas a Culicidae dans GBIF. Faux resultats.
- **Verdict** : NE PAS UTILISER ce taxonKey. Utiliser speciesKey=1651430 (Ae. albopictus) ou familyKey=3346 (Culicidae) a la place.

---

## SYNTHESE — Sources retenues pour le prototype

### Score S (Especes) — 0 a 25 points
| Source | Utilisation |
|--------|-------------|
| **GBIF Aedes albopictus** (speciesKey=1651430) | Distribution geolocalisee, 28k+ records en Europe |
| **VectorNet via GBIF** (datasetKey) | 120k observations de vecteurs, donnees officielles ECDC/EFSA |

### Score C (Climat) — 0 a 25 points
| Source | Utilisation |
|--------|-------------|
| **Open-Meteo Forecast** | Temperature, humidite, precipitations temps reel |
| **Open-Meteo Archive** | Moyennes climatiques historiques (depuis 1940) |

### Score D (Maladie) — 0 a 25 points
| Source | Utilisation |
|--------|-------------|
| **ECDC Atlas REST API** | 17 462 lignes CSV : WNV + dengue + chikungunya + malaria par pays/an (2003-2024) |
| Donnees historiques WNV (page ECDC) | Cas par pays depuis 2011 : IT(455), GR(217), ES(138) en 2024 |

### Score O (Observations) — 0 a 25 points
| Source | Utilisation |
|--------|-------------|
| **Mosquito Alert** (GitHub ZIP) | Observations citoyennes geolocalisees, 5 especes |

### Donnees support
| Source | Utilisation |
|--------|-------------|
| **NUTS3 GeoJSON** | Carte interactive du dashboard |
| **Eurostat Population** | Ponderation du risque par population exposee |
| **Eurostat Tourisme** | Business case (impact economique) |
| **Open-Meteo Climate CMIP6** | Slide pitch (projection future du risque) |

---

## ANNEXE — Donnees historiques WNV extraites (page ECDC)

Source : https://www.ecdc.europa.eu/en/west-nile-fever/surveillance-and-disease-data/historical

| Annee | Cas EU | Top 3 pays | Deces |
|-------|--------|-----------|-------|
| 2024 | 1 436 | Italie (455), Grece (217), Espagne (138) | 125 |
| 2023 | 709 | Italie (336), Grece (162), Roumanie (103) | 67 |
| 2022 | 1 112 | Italie (723), Grece (283), Roumanie (47) | 92 |
| 2021 | 139 | Grece (57), Italie (55), Hongrie (7) | 10 |
| 2020 | 316 | Grece (143), Espagne (77), Italie (66) | 38 |
| 2019 | 410 | Grece (223), Roumanie (66), Italie (53) | 50 |
| 2018 | 2 083 | Pic historique | - |

---

## ANNEXE — ECDC Atlas API : toutes les maladies vectorielles disponibles

L'API couvre 79 maladies. Celles pertinentes pour MosqRisk :

| Code | ID | Maladie | Pertinence MosqRisk |
|------|-----|---------|-------------------|
| WNF | 60 | West Nile virus infection | ESSENTIEL — transmis par Culex |
| DENGUE | 16 | Dengue | ESSENTIEL — transmis par Aedes |
| CHIK | 11 | Chikungunya | IMPORTANT — transmis par Aedes |
| MALA | 34 | Malaria | CONTEXTE — surtout cas importes |
| ZIKA | 70 | Zika virus infection | BONUS — transmis par Aedes |
| TBE | 56 | Tick-borne encephalitis | CONTEXTE — vecteur different (tiques) |

---

## Legende

- ✅ Fonctionne — exploitable directement pour le proto
- ⚠️ Partiellement exploitable — necessite un contournement ou du travail
- ❌ Ne fonctionne pas / inaccessible
