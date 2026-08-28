"""
Script 7 : Calcul du MosqRisk Score par region NUTS3.
Utilise les centroides du GeoJSON + donnees reelles par region.

- S (Especes)      : base pays + modulation latitude (sud = +risque)
- C (Climat)       : estimation basee sur latitude + altitude proxy
- D (Maladie)      : base pays + ponderation par densite population
- O (Observations) : donnees Mosquito Alert par NUTS3 directement
"""

import json
import os
import zipfile
import pandas as pd

PROCESSED_DIR = os.path.join(os.path.dirname(__file__), '..', 'processed')
DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')


def load_json(filename):
    filepath = os.path.join(PROCESSED_DIR, filename)
    if not os.path.exists(filepath):
        return None
    with open(filepath) as f:
        return json.load(f)


def compute_centroid(coords):
    """Calcule le centroide approximatif d'une geometrie GeoJSON."""
    all_points = []

    def extract_points(c):
        if isinstance(c[0], (int, float)):
            all_points.append(c)
        else:
            for sub in c:
                extract_points(sub)

    extract_points(coords)
    if not all_points:
        return None, None
    lon = sum(p[0] for p in all_points) / len(all_points)
    lat = sum(p[1] for p in all_points) / len(all_points)
    return lat, lon


def load_mosquito_alert_nuts3():
    """Charge les observations Mosquito Alert par NUTS3."""
    zip_path = os.path.join(DATA_DIR, 'mosquito-alert', 'all_reports.zip')
    if not os.path.exists(zip_path):
        return {}

    counts = {}
    with zipfile.ZipFile(zip_path, 'r') as z:
        json_files = sorted([f for f in z.namelist() if f.endswith('.json')])
        # Load recent years only (2021-2026) for relevant data
        for jf_name in json_files:
            year = jf_name.split('all_reports')[-1].replace('.json', '')
            if year.isdigit() and int(year) >= 2021:
                with z.open(jf_name) as f:
                    data = json.load(f)
                    for obs in data:
                        nuts3 = obs.get('nuts_3')
                        if nuts3 and obs.get('type') == 'adult':
                            counts[nuts3] = counts.get(nuts3, 0) + 1

    return counts


def score_species_nuts3(country_code, lat, species_country):
    """Score S par NUTS3 : base pays + modulation latitude."""
    base = species_country.get(country_code, 0)

    # Modulation par latitude : sud de l'Europe = plus de moustiques
    # 35-38 lat = +5, 38-42 = +3, 42-46 = 0, 46-50 = -3, 50+ = -5
    if lat < 38:
        lat_mod = 5
    elif lat < 42:
        lat_mod = 3
    elif lat < 46:
        lat_mod = 0
    elif lat < 50:
        lat_mod = -3
    else:
        lat_mod = -5

    return max(0, min(25, base + lat_mod))


def score_climate_nuts3(lat, lon):
    """Score C par NUTS3 : estimation basee sur latitude/longitude."""
    # Modele simplifie : favorabilite decroit avec la latitude
    # Zone optimale : 36-44 lat, pres des cotes mediterraneennes
    if 36 <= lat <= 44:
        base = 20
    elif 44 < lat <= 48:
        base = 14
    elif 48 < lat <= 52:
        base = 8
    elif lat > 52:
        base = 4
    else:
        base = 15  # Afrique du Nord

    # Bonus Mediterranee (lon -5 a 25, lat < 46)
    if lat < 46 and -5 <= lon <= 25:
        base += 3

    # Malus zones tres chaudes/seches (Grece iles, Sicile en ete = trop chaud)
    if lat < 37 and lon > 20:
        base -= 2

    # Malus zones continentales froides
    if lon > 20 and lat > 46:
        base -= 2

    return max(0, min(25, base))


def score_disease_nuts3(country_code, density, disease_data):
    """Score D par NUTS3 : base pays + ponderation densite."""
    if not disease_data:
        return 0

    # Score base pays (identique au script 06)
    total = 0
    wnv = disease_data.get('wnv', {}).get(country_code, {})
    for year in ['2024', '2023', '2022']:
        cases = wnv.get(year, 0)
        if cases > 0:
            if cases >= 200: total += 12
            elif cases >= 50: total += 8
            elif cases >= 10: total += 5
            else: total += 2
            break

    dengue = disease_data.get('dengue', {}).get(country_code, {})
    for year in ['2024', '2023', '2022']:
        cases = dengue.get(year, 0)
        if cases > 0:
            if cases >= 1000: total += 8
            elif cases >= 200: total += 5
            elif cases >= 50: total += 3
            else: total += 1
            break

    chik = disease_data.get('chikungunya', {}).get(country_code, {})
    for year in ['2024', '2023', '2022']:
        cases = chik.get(year, 0)
        if cases > 0:
            if cases >= 50: total += 5
            elif cases >= 10: total += 3
            else: total += 1
            break

    base = min(25, total)

    # Modulation par densite : zones denses = plus de risque de transmission
    if density and density > 0:
        if density > 5000:
            density_mod = 5
        elif density > 1000:
            density_mod = 3
        elif density > 500:
            density_mod = 1
        elif density < 50:
            density_mod = -3
        else:
            density_mod = 0
        base = max(0, min(25, base + density_mod))

    return base


def score_observations_nuts3(nuts3_code, ma_counts):
    """Score O par NUTS3 : observations Mosquito Alert directes."""
    count = ma_counts.get(nuts3_code, 0)
    if count >= 2000:
        return 25
    elif count >= 1000:
        return 20
    elif count >= 500:
        return 16
    elif count >= 200:
        return 12
    elif count >= 100:
        return 8
    elif count >= 30:
        return 5
    elif count >= 5:
        return 2
    else:
        return 0


def risk_class(total):
    if total >= 75: return 'E'
    elif total >= 55: return 'D'
    elif total >= 40: return 'C'
    elif total >= 25: return 'B'
    else: return 'A'


def main():
    print("MosqRisk Score NUTS3 — Calcul par region")
    print("=" * 60)

    # Charger les donnees
    geojson_path = os.path.join(DATA_DIR, 'geo', 'nuts3_europe_20m.geojson')
    with open(geojson_path) as f:
        geojson = json.load(f)

    disease_data = load_json('disease_cases_by_country.json')
    population = load_json('population_nuts3.json')
    species_dist = load_json('species_distribution_europe.json')

    # Calculer le score especes par pays depuis GBIF
    species_country = {}
    if species_dist:
        albo = species_dist.get('aedes_albopictus', {}).get('counts_by_country', {})
        for code, count in albo.items():
            if count >= 5000: species_country[code] = 25
            elif count >= 2000: species_country[code] = 20
            elif count >= 500: species_country[code] = 15
            elif count >= 100: species_country[code] = 10
            elif count > 0: species_country[code] = 5

    # Charger Mosquito Alert par NUTS3
    print("  Chargement Mosquito Alert NUTS3...")
    ma_counts = load_mosquito_alert_nuts3()
    print(f"  {len(ma_counts)} regions NUTS3 avec observations")

    # ECDC utilise EL pour la Grece, GeoJSON utilise EL aussi
    # Mapping GeoJSON CNTR_CODE -> notre code
    CNTR_MAP = {'GR': 'EL'}

    # Calculer les scores
    print("  Calcul des scores...")
    results = {}
    class_counts = {'A': 0, 'B': 0, 'C': 0, 'D': 0, 'E': 0}

    for feat in geojson['features']:
        props = feat['properties']
        nuts_id = props['NUTS_ID']
        cntr = props['CNTR_CODE']
        country_code = CNTR_MAP.get(cntr, cntr)
        name = props.get('NUTS_NAME') or props.get('NAME_LATN', nuts_id)

        lat, lon = compute_centroid(feat['geometry']['coordinates'])
        if lat is None:
            continue

        density = None
        if population and nuts_id in population:
            density = population[nuts_id].get('density')

        s = score_species_nuts3(country_code, lat, species_country)
        c = score_climate_nuts3(lat, lon)
        d = score_disease_nuts3(country_code, density, disease_data)
        o = score_observations_nuts3(nuts_id, ma_counts)

        total = s + c + d + o
        cls = risk_class(total)
        class_counts[cls] += 1

        results[nuts_id] = {
            'name': name,
            'country': country_code,
            'lat': round(lat, 2),
            'lon': round(lon, 2),
            's': s, 'c': c, 'd': d, 'o': o,
            'total': total,
            'risk_class': cls,
        }

    # Affichage
    print(f"\n  {len(results)} regions scorees")
    print(f"\n  Distribution des classes:")
    for cls in ['E', 'D', 'C', 'B', 'A']:
        print(f"    {cls}: {class_counts[cls]} regions")

    # Top 20 regions a risque
    top = sorted(results.items(), key=lambda x: x[1]['total'], reverse=True)[:20]
    print(f"\n  Top 20 regions a risque:")
    print(f"  {'NUTS3':<8} {'Nom':<30} {'S':>3} {'C':>3} {'D':>3} {'O':>3} {'Tot':>4} {'Cls':>3}")
    print("  " + "-" * 60)
    for nuts_id, r in top:
        print(f"  {nuts_id:<8} {r['name'][:30]:<30} {r['s']:>3} {r['c']:>3} {r['d']:>3} {r['o']:>3} {r['total']:>4} {r['risk_class']:>3}")

    # Bottom 10
    bottom = sorted(results.items(), key=lambda x: x[1]['total'])[:10]
    print(f"\n  10 regions les plus sures:")
    for nuts_id, r in bottom:
        print(f"  {nuts_id:<8} {r['name'][:30]:<30} {r['total']:>4} {r['risk_class']:>3}")

    # Sauvegarder
    outpath = os.path.join(PROCESSED_DIR, 'risk_score_by_nuts3.json')
    with open(outpath, 'w') as f:
        json.dump(results, f)
    print(f"\n  Sauvegarde: {outpath}")

    # Copier vers proto
    proto_path = os.path.join(os.path.dirname(__file__), '..', 'proto', 'public', 'data', 'risk_score_by_nuts3.json')
    with open(proto_path, 'w') as f:
        json.dump(results, f)
    print(f"  Copie proto: {proto_path}")


if __name__ == '__main__':
    main()
