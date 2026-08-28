"""
Script 5 : Telecharger GeoJSON NUTS3 + Eurostat population.
- GeoJSON NUTS3 20M 2024 (simplifie pour le web)
- Population/densite par region NUTS3 via Eurostat API
- Sauvegarde dans data/geo/ et processed/
"""

import requests
import json
import os

DATA_DIR_GEO = os.path.join(os.path.dirname(__file__), '..', 'data', 'geo')
DATA_DIR_EUROSTAT = os.path.join(os.path.dirname(__file__), '..', 'data', 'eurostat')
PROCESSED_DIR = os.path.join(os.path.dirname(__file__), '..', 'processed')

GEOJSON_URL = "https://gisco-services.ec.europa.eu/distribution/v2/nuts/geojson/NUTS_RG_20M_2024_4326_LEVL_3.geojson"
EUROSTAT_POP_URL = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/DEMO_R_D3DENS"

# Pays cibles pour le proto MosqRisk
TARGET_COUNTRIES = ['FR', 'IT', 'ES', 'EL', 'DE', 'PT', 'HR', 'RO', 'BG', 'HU', 'AT', 'SI', 'SK', 'CZ', 'PL', 'BE', 'NL']


def download_geojson():
    """Telecharge le GeoJSON NUTS3."""
    outpath = os.path.join(DATA_DIR_GEO, 'nuts3_europe_20m.geojson')
    if os.path.exists(outpath):
        size_mb = os.path.getsize(outpath) / 1e6
        print(f"  GeoJSON deja present: {outpath} ({size_mb:.1f} Mo)")
        return outpath

    print(f"  Telechargement GeoJSON NUTS3...")
    resp = requests.get(GEOJSON_URL, timeout=60)
    resp.raise_for_status()

    with open(outpath, 'w') as f:
        f.write(resp.text)

    size_mb = os.path.getsize(outpath) / 1e6
    print(f"  Telecharge: {outpath} ({size_mb:.1f} Mo)")
    return outpath


def analyze_geojson(filepath):
    """Analyse le GeoJSON NUTS3."""
    with open(filepath) as f:
        geojson = json.load(f)

    features = geojson['features']
    print(f"\n  GeoJSON NUTS3:")
    print(f"    Features totales: {len(features)}")

    # Compter par pays
    by_country = {}
    for feat in features:
        code = feat['properties'].get('CNTR_CODE', '??')
        by_country[code] = by_country.get(code, 0) + 1

    print(f"    Pays: {len(by_country)}")
    # Top pays
    sorted_countries = sorted(by_country.items(), key=lambda x: x[1], reverse=True)
    print(f"    Top 10 pays par nombre de regions NUTS3:")
    for code, count in sorted_countries[:10]:
        print(f"      {code}: {count} regions")

    # Filtrer pour les pays cibles
    target_features = [f for f in features if f['properties'].get('CNTR_CODE') in TARGET_COUNTRIES]
    print(f"\n    Regions dans pays cibles ({len(TARGET_COUNTRIES)} pays): {len(target_features)}")

    # Extraire la liste des NUTS3 codes pour les pays cibles
    nuts3_codes = [f['properties']['NUTS_ID'] for f in target_features]
    return nuts3_codes, len(features)


def fetch_eurostat_population(nuts3_codes):
    """Recupere la densite de population pour les regions NUTS3 cibles."""
    print(f"\n  Eurostat Population NUTS3...")

    # L'API Eurostat a une limite de taille d'URL, on fait par batches
    batch_size = 50
    all_data = {}

    for i in range(0, len(nuts3_codes), batch_size):
        batch = nuts3_codes[i:i + batch_size]
        params = {
            'lang': 'EN',
            'time': '2023',
        }
        # Ajouter les codes geo
        url = EUROSTAT_POP_URL + '?' + '&'.join(
            [f'lang=EN', 'time=2023'] + [f'geo={code}' for code in batch]
        )

        try:
            resp = requests.get(url, timeout=30)
            resp.raise_for_status()
            data = resp.json()

            # Parser JSON-stat
            dimensions = data.get('dimension', {})
            geo_dim = dimensions.get('geo', {}).get('category', {})
            geo_index = geo_dim.get('index', {})
            geo_labels = geo_dim.get('label', {})
            values = data.get('value', {})

            for geo_code, idx in geo_index.items():
                val = values.get(str(idx))
                if val is not None:
                    all_data[geo_code] = {
                        'density': round(val, 1),
                        'name': geo_labels.get(geo_code, geo_code),
                    }

        except Exception as e:
            print(f"    Batch {i}-{i+batch_size}: ERREUR {e}")

        if i > 0 and i % 200 == 0:
            print(f"    {i}/{len(nuts3_codes)} regions traitees...")

    print(f"    Regions avec donnees de population: {len(all_data)}")

    # Stats
    if all_data:
        densities = [v['density'] for v in all_data.values()]
        print(f"    Densite min: {min(densities)} hab/km2")
        print(f"    Densite max: {max(densities)} hab/km2")
        print(f"    Densite moyenne: {sum(densities)/len(densities):.1f} hab/km2")

        # Top 10 plus denses
        top = sorted(all_data.items(), key=lambda x: x[1]['density'], reverse=True)[:10]
        print(f"\n    Top 10 regions les plus denses:")
        for code, info in top:
            print(f"      {code} ({info['name']}): {info['density']} hab/km2")

    return all_data


def main():
    os.makedirs(DATA_DIR_GEO, exist_ok=True)
    os.makedirs(DATA_DIR_EUROSTAT, exist_ok=True)
    os.makedirs(PROCESSED_DIR, exist_ok=True)

    print("GeoJSON NUTS3 + Eurostat Population")
    print(f"{'='*60}")

    # GeoJSON
    geojson_path = download_geojson()
    nuts3_codes, total_features = analyze_geojson(geojson_path)

    # Eurostat population
    pop_data = fetch_eurostat_population(nuts3_codes)

    # Sauvegarder population
    outpath = os.path.join(PROCESSED_DIR, 'population_nuts3.json')
    with open(outpath, 'w') as f:
        json.dump(pop_data, f, indent=2)
    print(f"\nSauvegarde population: {outpath}")

    # Resume
    print(f"\n{'='*60}")
    print("  RESUME")
    print(f"{'='*60}")
    print(f"  GeoJSON: {total_features} regions NUTS3 en Europe")
    print(f"  Pays cibles: {len(TARGET_COUNTRIES)} pays, {len(nuts3_codes)} regions")
    print(f"  Population: {len(pop_data)} regions avec densite")


if __name__ == '__main__':
    main()
