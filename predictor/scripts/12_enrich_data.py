"""
Script 12 : Enrichir les donnees pour la V2 du dashboard.
1. WHO ARBOV Dengue → cas mensuels par pays europeen
2. Eurostat Tourisme → nuitees par NUTS2 (mapping vers NUTS3)
3. Tendance temporelle → score simule 2020-2024 par pays
4. Climate CMIP6 → projection 2050 pour villes cles
5. VectAbundance GBIF → ovitraps terrain
Sauvegarde tout dans processed/ et client/public/data/
"""

import requests
import json
import os
import time

PROCESSED_DIR = os.path.join(os.path.dirname(__file__), '..', 'processed')
PROTO_DATA = os.path.join(os.path.dirname(__file__), '..', '..', 'client', 'public', 'data')


def save(data, filename):
    for d in [PROCESSED_DIR, PROTO_DATA]:
        with open(os.path.join(d, filename), 'w') as f:
            json.dump(data, f, indent=2 if len(json.dumps(data)) < 500000 else None)
    print(f"    Sauvegarde: {filename}")


# ──────────────────────────────────────────
# 1. WHO ARBOV Dengue
# ──────────────────────────────────────────
def fetch_who_dengue():
    print("\n1. WHO ARBOV Dengue — cas mensuels Europe")
    print("-" * 50)

    countries = ['FRA', 'ITA', 'ESP', 'GRC', 'DEU', 'PRT', 'HRV', 'AUT', 'HUN', 'ROU', 'BGR', 'TUR']
    iso_filter = ' or '.join(f"ISO3 eq '{c}'" for c in countries)
    url = f"https://xmart-api-public.who.int/ARBOV/V_DENGUE_GLOBAL_VALIDATED_PUBLIC?$filter={iso_filter}&$orderby=YEAR desc,ISOWEEK desc"

    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        rows = data.get('value', [])
        print(f"    {len(rows)} lignes recues")

        # Structurer par pays et annee
        result = {}
        for row in rows:
            iso = row.get('ISO3', '')
            year = row.get('YEAR')
            cases = row.get('DENGUE_TOTAL_SUSP_CONF')
            deaths = row.get('DENGUE_DEATHS')
            severe = row.get('DENGUE_SEVERE')
            if not iso or not year:
                continue

            if iso not in result:
                result[iso] = {}
            if str(year) not in result[iso]:
                result[iso][str(year)] = {'cases': 0, 'deaths': 0, 'severe': 0, 'months': {}}

            result[iso][str(year)]['cases'] += (cases or 0)
            result[iso][str(year)]['deaths'] += (deaths or 0)
            result[iso][str(year)]['severe'] += (severe or 0)

            # Par mois
            week = row.get('ISOWEEK', 0)
            month = min(12, max(1, (week - 1) // 4 + 1)) if week else 0
            if month:
                m = str(month)
                result[iso][str(year)]['months'][m] = result[iso][str(year)]['months'].get(m, 0) + (cases or 0)

        for iso, years in result.items():
            latest = max(years.keys())
            total = years[latest]['cases']
            print(f"    {iso}: {total} cas en {latest}")

        save(result, 'who_dengue_europe.json')
        return result

    except Exception as e:
        print(f"    ERREUR: {e}")
        return {}


# ──────────────────────────────────────────
# 2. Eurostat Tourisme
# ──────────────────────────────────────────
def fetch_eurostat_tourism():
    print("\n2. Eurostat Tourisme — nuitees par NUTS2")
    print("-" * 50)

    # On va chercher les pays cles en NUTS2
    nuts2_codes = [
        'FR10', 'FRL0', 'FRJ1', 'FRJ2', 'FRK2', 'FRE2',  # France
        'ITC4', 'ITH3', 'ITH5', 'ITI4', 'ITF3', 'ITG1',  # Italie
        'ES51', 'ES52', 'ES61', 'ES30', 'ES53',  # Espagne
        'EL30', 'EL42', 'EL43',  # Grece
        'DE21', 'DE71', 'DE30', 'DE50',  # Allemagne
        'AT13', 'HU11', 'HR05',  # Autriche, Hongrie, Croatie
    ]

    geo_params = '&'.join(f'geo={c}' for c in nuts2_codes)
    url = f"https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/TOUR_OCC_NIN2?lang=EN&time=2023&nace_r2=I551-I553&c_resid=TOTAL&unit=NR&{geo_params}"

    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        data = resp.json()

        geo_dim = data.get('dimension', {}).get('geo', {}).get('category', {})
        geo_index = geo_dim.get('index', {})
        geo_labels = geo_dim.get('label', {})
        values = data.get('value', {})

        result = {}
        for code, idx in geo_index.items():
            val = values.get(str(idx))
            if val:
                result[code] = {
                    'name': geo_labels.get(code, code),
                    'nights_2023': int(val),
                }
                print(f"    {code} ({geo_labels.get(code, '?')}): {int(val):,} nuitees")

        save(result, 'tourism_nuts2.json')
        return result

    except Exception as e:
        print(f"    ERREUR: {e}")
        return {}


# ──────────────────────────────────────────
# 3. Tendance temporelle du score (simule)
# ──────────────────────────────────────────
def compute_trend():
    print("\n3. Tendance temporelle — evolution 2020-2024")
    print("-" * 50)

    # Charger les scores actuels
    with open(os.path.join(PROCESSED_DIR, 'risk_score_by_nuts3.json')) as f:
        scores = json.load(f)

    # Charger les cas ECDC par pays
    with open(os.path.join(PROCESSED_DIR, 'disease_cases_by_country.json')) as f:
        disease = json.load(f)

    # Pour chaque pays, simuler l'evolution du score
    # Basee sur les cas reels ECDC + tendance climatique
    countries = {}
    for nuts_id, data in scores.items():
        c = data.get('country', '')
        if c not in countries:
            countries[c] = {'total_score': 0, 'count': 0, 'name': ''}
        countries[c]['total_score'] += data['total']
        countries[c]['count'] += 1

    trends = {}
    for country, info in countries.items():
        if info['count'] == 0:
            continue
        avg_2024 = info['total_score'] / info['count']

        # Estimation tendance : le risque augmente d'environ 3-5% par an
        # Basee sur l'expansion du moustique tigre
        trend = {}
        for year in [2020, 2021, 2022, 2023, 2024]:
            years_back = 2024 - year
            # Le risque etait plus bas dans le passe
            factor = 1 - years_back * 0.06  # ~6% par an
            # Ajouter variabilite annuelle basee sur les cas WNV reels
            wnv = disease.get('wnv', {}).get(country, {}).get(str(year), 0)
            wnv_bonus = min(5, wnv / 50) if wnv else 0
            score = max(5, round(avg_2024 * factor + wnv_bonus))
            trend[str(year)] = score

        trends[country] = trend

    # Aussi generer pour quelques regions cles
    key_regions = ['ITH35', 'ES511', 'FRL04', 'ITI43', 'HU110', 'AT130', 'EL303', 'DEA23']
    region_trends = {}
    for nuts_id in key_regions:
        if nuts_id not in scores:
            continue
        s = scores[nuts_id]
        current = s['total']
        trend = {}
        for year in [2020, 2021, 2022, 2023, 2024]:
            years_back = 2024 - year
            factor = 1 - years_back * 0.07
            wnv = disease.get('wnv', {}).get(s['country'], {}).get(str(year), 0)
            wnv_bonus = min(5, wnv / 50) if wnv else 0
            trend[str(year)] = max(5, round(current * factor + wnv_bonus))
        region_trends[nuts_id] = {'name': s['name'], 'country': s['country'], 'trend': trend}

    result = {'by_country': trends, 'by_region': region_trends}
    save(result, 'risk_trends.json')

    # Afficher quelques tendances
    for country in ['IT', 'ES', 'FR', 'DE', 'EL']:
        if country in trends:
            vals = [f"{y}:{v}" for y, v in sorted(trends[country].items())]
            print(f"    {country}: {', '.join(vals)}")

    return result


# ──────────────────────────────────────────
# 4. Climate CMIP6 — projections 2050
# ──────────────────────────────────────────
def fetch_climate_projections():
    print("\n4. Climate CMIP6 — projections 2050")
    print("-" * 50)

    cities = {
        'marseille': {'lat': 43.3, 'lon': 5.4, 'name': 'Marseille'},
        'stockholm': {'lat': 59.3, 'lon': 18.1, 'name': 'Stockholm'},
        'paris': {'lat': 48.9, 'lon': 2.3, 'name': 'Paris'},
        'berlin': {'lat': 52.5, 'lon': 13.4, 'name': 'Berlin'},
        'rome': {'lat': 41.9, 'lon': 12.5, 'name': 'Rome'},
        'athens': {'lat': 38.0, 'lon': 23.7, 'name': 'Athenes'},
        'barcelona': {'lat': 41.4, 'lon': 2.2, 'name': 'Barcelona'},
    }

    result = {}
    for key, city in cities.items():
        try:
            # Temp actuelle (ete 2024)
            resp1 = requests.get(f"https://archive-api.open-meteo.com/v1/archive?latitude={city['lat']}&longitude={city['lon']}&start_date=2024-06-01&end_date=2024-08-31&daily=temperature_2m_mean&timezone=Europe/Paris", timeout=15)
            current_temps = resp1.json().get('daily', {}).get('temperature_2m_mean', [])
            current_avg = round(sum(t for t in current_temps if t) / len([t for t in current_temps if t]), 1) if current_temps else 0

            # Projection 2050
            resp2 = requests.get(f"https://climate-api.open-meteo.com/v1/climate?latitude={city['lat']}&longitude={city['lon']}&start_date=2050-06-01&end_date=2050-08-31&daily=temperature_2m_mean&models=EC_Earth3P_HR", timeout=15)
            future_temps = resp2.json().get('daily', {}).get('temperature_2m_mean', [])
            future_avg = round(sum(t for t in future_temps if t) / len([t for t in future_temps if t]), 1) if future_temps else 0

            delta = round(future_avg - current_avg, 1)
            result[key] = {
                'name': city['name'],
                'current_summer_avg': current_avg,
                'projected_2050_avg': future_avg,
                'delta': delta,
            }
            print(f"    {city['name']}: {current_avg}C → {future_avg}C ({'+' if delta > 0 else ''}{delta}C)")
            time.sleep(0.2)

        except Exception as e:
            print(f"    {city['name']}: ERREUR {e}")

    save(result, 'climate_projections_2050.json')
    return result


# ──────────────────────────────────────────
# 5. VectAbundance via GBIF
# ──────────────────────────────────────────
def fetch_vectabundance():
    print("\n5. VectAbundance — donnees ovitraps terrain")
    print("-" * 50)

    # Dataset VectAbundance sur GBIF
    # Chercher les datasets avec des comptages d'oeufs
    url = "https://api.gbif.org/v1/occurrence/search?datasetKey=3991e23f-c0c4-4548-a2ae-7b21b3a4703e&limit=300&hasCoordinate=true"

    try:
        resp = requests.get(url, timeout=15)
        data = resp.json()
        count = data.get('count', 0)
        results = data.get('results', [])
        print(f"    AIMSurv dataset: {count} total, {len(results)} charges")

        if not results:
            # Essayer un autre dataset — VectAbundance
            url2 = "https://api.gbif.org/v1/occurrence/search?q=ovitrap+Aedes&hasCoordinate=true&limit=200&country=FR"
            resp2 = requests.get(url2, timeout=15)
            data2 = resp2.json()
            results = data2.get('results', [])
            print(f"    Ovitrap search: {data2.get('count', 0)} total, {len(results)} charges")

        points = []
        for r in results:
            lat = r.get('decimalLatitude')
            lon = r.get('decimalLongitude')
            count_val = r.get('individualCount', 0)
            species = r.get('species', r.get('genus', ''))
            date = r.get('eventDate', '')
            country = r.get('country', '')

            if lat and lon and 34 < lat < 72:
                points.append({
                    'lat': round(lat, 4),
                    'lon': round(lon, 4),
                    'count': count_val or 0,
                    'species': species,
                    'date': date[:10] if date else '',
                    'country': country,
                })

        print(f"    {len(points)} points de terrain en Europe")
        save(points, 'vectabundance_points.json')
        return points

    except Exception as e:
        print(f"    ERREUR: {e}")
        return []


# ──────────────────────────────────────────
# 6. Generer donnees alertes
# ──────────────────────────────────────────
def generate_alerts():
    print("\n6. Alertes — regions ayant change de niveau")
    print("-" * 50)

    with open(os.path.join(PROCESSED_DIR, 'risk_score_by_nuts3.json')) as f:
        scores = json.load(f)

    # Simuler les alertes : regions en D/E avec des facteurs aggravants
    alerts = []
    for nuts_id, data in scores.items():
        if data.get('risk_class') == 'E':
            alerts.append({
                'nuts_id': nuts_id,
                'name': data['name'],
                'country': data['country'],
                'score': data['total'],
                'risk_class': 'E',
                'type': 'critical',
                'message': f"Risque critique ({data['total']}/100) — action recommandee",
            })
        elif data.get('risk_class') == 'D' and data.get('total', 0) >= 70:
            alerts.append({
                'nuts_id': nuts_id,
                'name': data['name'],
                'country': data['country'],
                'score': data['total'],
                'risk_class': 'D',
                'type': 'warning',
                'message': f"Risque eleve en hausse ({data['total']}/100) — surveillance renforcee",
            })

    alerts.sort(key=lambda a: a['score'], reverse=True)
    print(f"    {len(alerts)} alertes generees ({len([a for a in alerts if a['type']=='critical'])} critiques)")

    save(alerts, 'alerts.json')
    return alerts


# ──────────────────────────────────────────
# 7. Score couverture Qista
# ──────────────────────────────────────────
def compute_qista_coverage():
    print("\n7. Score couverture Qista")
    print("-" * 50)

    with open(os.path.join(PROTO_DATA, 'qista_bornes.json')) as f:
        bornes = json.load(f)

    with open(os.path.join(PROCESSED_DIR, 'risk_score_by_nuts3.json')) as f:
        scores = json.load(f)

    # Compter les bornes par NUTS3 (approximatif via lat/lon)
    # Hyeres = FRL05, Marseille = FRL04
    borne_counts = {}
    for b in bornes:
        city = b.get('city', '')
        if city == 'Hyeres':
            nuts = 'FRL05'
        elif city == 'Marseille':
            nuts = 'FRL04'
        elif city == 'Barcelona':
            nuts = 'ES511'
        elif city == 'Roma':
            nuts = 'ITI43'
        elif city == 'Montpellier':
            nuts = 'FRJ13'
        else:
            continue
        borne_counts[nuts] = borne_counts.get(nuts, 0) + 1

    coverage = {}
    for nuts_id, count in borne_counts.items():
        data = scores.get(nuts_id, {})
        original_score = data.get('total', 50)
        # Simuler la reduction : chaque borne reduit le score localement
        reduction_pct = min(40, count * 0.08)  # Max 40% de reduction
        protected_score = max(10, round(original_score * (1 - reduction_pct / 100)))

        coverage[nuts_id] = {
            'name': data.get('name', nuts_id),
            'bornes_count': count,
            'original_score': original_score,
            'protected_score': protected_score,
            'reduction_pct': round(reduction_pct, 1),
            'original_class': data.get('risk_class', '?'),
        }
        # Recalculer la classe
        s = protected_score
        coverage[nuts_id]['protected_class'] = 'E' if s >= 75 else 'D' if s >= 55 else 'C' if s >= 40 else 'B' if s >= 25 else 'A'

        print(f"    {nuts_id} ({data.get('name', '?')}): {count} bornes, {original_score} → {protected_score} ({coverage[nuts_id]['original_class']} → {coverage[nuts_id]['protected_class']})")

    save(coverage, 'qista_coverage.json')
    return coverage


def main():
    os.makedirs(PROCESSED_DIR, exist_ok=True)
    os.makedirs(PROTO_DATA, exist_ok=True)

    print("=" * 60)
    print("  ENRICHISSEMENT V2 — 7 sources de donnees")
    print("=" * 60)

    fetch_who_dengue()
    fetch_eurostat_tourism()
    compute_trend()
    fetch_climate_projections()
    fetch_vectabundance()
    generate_alerts()
    compute_qista_coverage()

    print("\n" + "=" * 60)
    print("  TERMINE — tous les fichiers generes dans processed/ et client/public/data/")
    print("=" * 60)


if __name__ == '__main__':
    main()
