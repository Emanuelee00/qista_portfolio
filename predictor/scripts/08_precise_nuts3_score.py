"""
Script 08 : Calcul PRECIS du MosqRisk Score par region NUTS3.

S (Especes) : point-in-polygon GBIF Aedes albopictus dans chaque NUTS3
C (Climat)  : Open-Meteo ete 2024 par centroide de region (batch API)
D (Maladie) : base pays + ponderation densite population NUTS3
O (Observations) : Mosquito Alert NUTS3 direct + GBIF fallback

Necessite geopandas pour le spatial join.
"""

import json
import os
import time
import zipfile
import requests
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point

PROCESSED_DIR = os.path.join(os.path.dirname(__file__), '..', 'processed')
DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
GBIF_URL = "https://api.gbif.org/v1/occurrence/search"


def load_nuts3_geodataframe():
    """Charge le GeoJSON NUTS3 comme GeoDataFrame."""
    path = os.path.join(DATA_DIR, 'geo', 'nuts3_europe_20m.geojson')
    gdf = gpd.read_file(path)
    gdf = gdf.set_index('NUTS_ID')
    # Calculer les centroides
    gdf['centroid_lat'] = gdf.geometry.centroid.y
    gdf['centroid_lon'] = gdf.geometry.centroid.x
    print(f"  GeoDataFrame: {len(gdf)} regions NUTS3")
    return gdf


def fetch_gbif_aedes_all():
    """Telecharge TOUTES les observations Aedes albopictus geolocalisees en Europe via GBIF API."""
    species_key = 1651430  # Aedes albopictus
    all_obs = []
    offset = 0
    limit = 300

    # Pays europeens a requeter
    countries = ['ES', 'IT', 'FR', 'DE', 'AT', 'HR', 'HU', 'GR', 'PT', 'RO',
                 'BG', 'SI', 'RS', 'AL', 'BA', 'ME', 'MK', 'TR', 'CY', 'MT',
                 'BE', 'NL', 'CH', 'SK', 'CZ', 'PL', 'GB', 'SE', 'NO', 'DK']

    print(f"  Telechargement GBIF Aedes albopictus geolocalisees...")
    for country in countries:
        offset = 0
        country_count = 0
        while True:
            params = {
                'speciesKey': species_key,
                'country': country,
                'hasCoordinate': 'true',
                'limit': limit,
                'offset': offset,
                'fields': 'decimalLatitude,decimalLongitude,year,country',
            }
            try:
                resp = requests.get(GBIF_URL, params=params, timeout=15)
                resp.raise_for_status()
                data = resp.json()
                results = data.get('results', [])

                for r in results:
                    lat = r.get('decimalLatitude')
                    lon = r.get('decimalLongitude')
                    if lat and lon and -90 <= lat <= 90 and -180 <= lon <= 180:
                        all_obs.append({'lat': lat, 'lon': lon, 'country': country})

                country_count += len(results)
                if data.get('endOfRecords', True) or len(results) < limit:
                    break
                offset += limit

                # Limiter a 2000 par pays pour ne pas exploser le temps
                if offset >= 2000:
                    break

            except Exception as e:
                print(f"    ERREUR {country} offset={offset}: {e}")
                break

            time.sleep(0.05)

        if country_count > 0:
            print(f"    {country}: {country_count} obs")

    print(f"  Total GBIF: {len(all_obs)} observations geolocalisees")
    return all_obs


def spatial_join_gbif(gbif_obs, nuts3_gdf):
    """Assigne chaque observation GBIF a une region NUTS3 par point-in-polygon."""
    print(f"  Spatial join de {len(gbif_obs)} points dans {len(nuts3_gdf)} polygones...")

    points = gpd.GeoDataFrame(
        gbif_obs,
        geometry=[Point(o['lon'], o['lat']) for o in gbif_obs],
        crs='EPSG:4326'
    )

    joined = gpd.sjoin(points, nuts3_gdf[['geometry']], how='left', predicate='within')

    # Compter par NUTS3 — sjoin ajoute la colonne NUTS_ID (index du gdf)
    idx_col = 'NUTS_ID' if 'NUTS_ID' in joined.columns else joined.columns[-1]
    counts = joined.dropna(subset=[idx_col]).groupby(idx_col).size()
    result = counts.to_dict()
    print(f"  {len(result)} regions NUTS3 avec au moins 1 observation GBIF")
    return result


def load_mosquito_alert_nuts3():
    """Charge les observations Mosquito Alert par NUTS3 (adultes 2021+)."""
    zip_path = os.path.join(DATA_DIR, 'mosquito-alert', 'all_reports.zip')
    if not os.path.exists(zip_path):
        return {}

    counts = {}
    with zipfile.ZipFile(zip_path, 'r') as z:
        for jf_name in sorted(f for f in z.namelist() if f.endswith('.json')):
            year = jf_name.split('all_reports')[-1].replace('.json', '')
            if year.isdigit() and int(year) >= 2020:
                with z.open(jf_name) as f:
                    for obs in json.load(f):
                        nuts3 = obs.get('nuts_3')
                        if nuts3 and obs.get('type') == 'adult':
                            counts[nuts3] = counts.get(nuts3, 0) + 1
    print(f"  Mosquito Alert: {len(counts)} regions NUTS3")
    return counts


def fetch_climate_batch(centroids):
    """
    Appelle Open-Meteo archive pour l'ete 2024 sur les centroides.
    Utilise l'API multi-locations (max ~50 par appel).
    """
    print(f"  Calcul climat ete 2024 pour {len(centroids)} regions...")
    results = {}
    batch_size = 50

    keys = list(centroids.keys())
    for i in range(0, len(keys), batch_size):
        batch_keys = keys[i:i + batch_size]
        lats = ','.join(str(centroids[k]['lat']) for k in batch_keys)
        lons = ','.join(str(centroids[k]['lon']) for k in batch_keys)

        url = (f"https://archive-api.open-meteo.com/v1/archive"
               f"?latitude={lats}&longitude={lons}"
               f"&start_date=2024-06-01&end_date=2024-09-30"
               f"&daily=temperature_2m_mean,relative_humidity_2m_mean,precipitation_sum"
               f"&timezone=Europe/Paris")

        try:
            resp = requests.get(url, timeout=30)
            resp.raise_for_status()
            data = resp.json()

            # Si un seul point, data est un dict, sinon une liste
            if isinstance(data, dict):
                data = [data]

            for j, key in enumerate(batch_keys):
                if j < len(data) and 'daily' in data[j]:
                    daily = data[j]['daily']
                    temps = [t for t in daily.get('temperature_2m_mean', []) if t is not None]
                    hums = [h for h in daily.get('relative_humidity_2m_mean', []) if h is not None]
                    precs = [p for p in daily.get('precipitation_sum', []) if p is not None]

                    if temps and hums:
                        avg_temp = sum(temps) / len(temps)
                        avg_hum = sum(hums) / len(hums)
                        total_precip = sum(precs) if precs else 0
                        results[key] = {
                            'avg_temp': round(avg_temp, 1),
                            'avg_hum': round(avg_hum, 1),
                            'total_precip': round(total_precip, 1),
                        }
        except Exception as e:
            print(f"    Batch {i}-{i+batch_size}: ERREUR {e}")

        if i > 0 and i % 200 == 0:
            print(f"    {i}/{len(keys)} regions...")
        time.sleep(0.1)

    print(f"  Climat: {len(results)} regions avec donnees meteo")
    return results


def compute_climate_score(climate_info):
    """Score C (0-25) a partir des donnees meteo ete 2024."""
    if not climate_info:
        return 5  # fallback

    temp = climate_info['avg_temp']
    hum = climate_info['avg_hum']
    precip = climate_info['total_precip']

    # Temperature (0-10) : optimal 22-28C
    if 22 <= temp <= 28:
        t_score = 10
    elif 18 <= temp < 22:
        t_score = 5 + (temp - 18) * (5 / 4)
    elif 28 < temp <= 33:
        t_score = 10 - (temp - 28) * (5 / 5)
    elif 15 <= temp < 18:
        t_score = (temp - 15) * (5 / 3)
    else:
        t_score = max(0, 5 - abs(temp - 20) * 0.5)

    # Humidite (0-8) : >65% = favorable
    if hum >= 75:
        h_score = 8
    elif hum >= 60:
        h_score = 4 + (hum - 60) * (4 / 15)
    elif hum >= 45:
        h_score = (hum - 45) * (4 / 15)
    else:
        h_score = 0

    # Precipitations (0-7) : 200-600mm ete = ideal
    if 200 <= precip <= 600:
        p_score = 7
    elif 100 <= precip < 200:
        p_score = 3 + (precip - 100) * (4 / 100)
    elif precip > 600:
        p_score = max(3, 7 - (precip - 600) * (4 / 400))
    elif 50 <= precip < 100:
        p_score = (precip - 50) * (3 / 50)
    else:
        p_score = 0

    return min(25, round(t_score + h_score + p_score))


def compute_species_score(gbif_count):
    """Score S (0-25) base sur le nombre d'observations GBIF dans la region."""
    if gbif_count >= 200:
        return 25
    elif gbif_count >= 100:
        return 22
    elif gbif_count >= 50:
        return 18
    elif gbif_count >= 20:
        return 14
    elif gbif_count >= 10:
        return 10
    elif gbif_count >= 3:
        return 6
    elif gbif_count >= 1:
        return 3
    else:
        return 0


def compute_observation_score(ma_count, gbif_count):
    """Score O (0-25) combine Mosquito Alert + GBIF fallback."""
    # Mosquito Alert est la source principale
    total = ma_count

    # Ajouter GBIF comme signal supplementaire si peu de MA
    if ma_count < 50:
        total += gbif_count * 2  # Poids x2 car GBIF est plus rare

    if total >= 3000:
        return 25
    elif total >= 1500:
        return 22
    elif total >= 500:
        return 18
    elif total >= 200:
        return 14
    elif total >= 100:
        return 10
    elif total >= 30:
        return 7
    elif total >= 10:
        return 4
    elif total >= 1:
        return 2
    else:
        return 0


def compute_disease_score(country_code, density, disease_data):
    """Score D (0-25) par pays + modulation densite."""
    if not disease_data:
        return 0

    total = 0
    for disease, weight in [('wnv', 1.5), ('dengue', 1.0), ('chikungunya', 0.8)]:
        cases_by_year = disease_data.get(disease, {}).get(country_code, {})
        # Moyenne ponderee des 3 dernieres annees
        recent_cases = 0
        for year, w in [('2024', 1.0), ('2023', 0.6), ('2022', 0.3)]:
            recent_cases += cases_by_year.get(year, 0) * w

        if recent_cases >= 500:
            total += 8 * weight
        elif recent_cases >= 100:
            total += 5 * weight
        elif recent_cases >= 20:
            total += 3 * weight
        elif recent_cases >= 1:
            total += 1 * weight

    base = min(20, round(total))

    # Modulation densite (0-5 points)
    if density:
        if density > 3000:
            base += 5
        elif density > 1000:
            base += 4
        elif density > 500:
            base += 3
        elif density > 200:
            base += 2
        elif density > 50:
            base += 1

    return min(25, base)


def risk_class(total):
    if total >= 75: return 'E'
    if total >= 55: return 'D'
    if total >= 40: return 'C'
    if total >= 25: return 'B'
    return 'A'


def main():
    print("=" * 70)
    print("  MosqRisk Score PRECIS — par region NUTS3")
    print("=" * 70)

    # 1. Charger le GeoDataFrame NUTS3
    nuts3_gdf = load_nuts3_geodataframe()

    # 2. Telecharger et spatial join GBIF
    gbif_obs = fetch_gbif_aedes_all()
    gbif_by_nuts3 = spatial_join_gbif(gbif_obs, nuts3_gdf)

    # 3. Charger Mosquito Alert par NUTS3
    ma_counts = load_mosquito_alert_nuts3()

    # 4. Charger donnees maladies et population
    with open(os.path.join(PROCESSED_DIR, 'disease_cases_by_country.json')) as f:
        disease_data = json.load(f)
    with open(os.path.join(PROCESSED_DIR, 'population_nuts3.json')) as f:
        population = json.load(f)

    # 5. Calculer climat ete 2024 pour chaque region
    centroids = {}
    for nuts_id, row in nuts3_gdf.iterrows():
        centroids[nuts_id] = {'lat': round(row['centroid_lat'], 2), 'lon': round(row['centroid_lon'], 2)}
    climate_data = fetch_climate_batch(centroids)

    # 6. Calculer les scores
    print(f"\n  Calcul des scores pour {len(nuts3_gdf)} regions...")
    CNTR_MAP = {'GR': 'EL'}
    results = {}
    class_counts = {'A': 0, 'B': 0, 'C': 0, 'D': 0, 'E': 0}

    for nuts_id, row in nuts3_gdf.iterrows():
        cntr = row['CNTR_CODE']
        country_code = CNTR_MAP.get(cntr, cntr)
        name = row.get('NUTS_NAME') or row.get('NAME_LATN') or nuts_id

        gbif_count = gbif_by_nuts3.get(nuts_id, 0)
        ma_count = ma_counts.get(nuts_id, 0)
        density = population.get(nuts_id, {}).get('density') if nuts_id in population else None
        climate = climate_data.get(nuts_id)

        s = compute_species_score(gbif_count)
        c = compute_climate_score(climate)
        d = compute_disease_score(country_code, density, disease_data)
        o = compute_observation_score(ma_count, gbif_count)

        total = s + c + d + o
        cls = risk_class(total)
        class_counts[cls] += 1

        results[nuts_id] = {
            'name': name,
            'country': country_code,
            'lat': round(row['centroid_lat'], 2),
            'lon': round(row['centroid_lon'], 2),
            's': s, 'c': c, 'd': d, 'o': o,
            'total': total,
            'risk_class': cls,
            'gbif_obs': gbif_count,
            'ma_obs': ma_count,
            'density': round(density, 1) if density else None,
        }

    # Affichage
    print(f"\n  {len(results)} regions scorees")
    print(f"\n  Distribution des classes:")
    for cls in ['E', 'D', 'C', 'B', 'A']:
        print(f"    {cls}: {class_counts[cls]} regions")

    top = sorted(results.items(), key=lambda x: x[1]['total'], reverse=True)[:25]
    print(f"\n  Top 25 regions a risque:")
    print(f"  {'NUTS3':<8} {'Nom':<28} {'S':>3} {'C':>3} {'D':>3} {'O':>3} {'Tot':>4} {'Cls':>3}  GBIF  MA   Dens")
    print("  " + "-" * 85)
    for nuts_id, r in top:
        dens = f"{r['density']:.0f}" if r['density'] else '-'
        print(f"  {nuts_id:<8} {r['name'][:28]:<28} {r['s']:>3} {r['c']:>3} {r['d']:>3} {r['o']:>3} {r['total']:>4} {r['risk_class']:>3}  {r['gbif_obs']:>4}  {r['ma_obs']:>4}  {dens:>5}")

    # Sauvegarder
    outpath = os.path.join(PROCESSED_DIR, 'risk_score_by_nuts3.json')
    with open(outpath, 'w') as f:
        json.dump(results, f)
    print(f"\n  Sauvegarde: {outpath}")

    proto_path = os.path.join(os.path.dirname(__file__), '..', 'proto', 'public', 'data', 'risk_score_by_nuts3.json')
    with open(proto_path, 'w') as f:
        json.dump(results, f)
    print(f"  Copie proto: {proto_path}")


if __name__ == '__main__':
    main()
