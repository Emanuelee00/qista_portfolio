"""
Script 3 : Interroger GBIF pour la distribution des Aedes en Europe.
- Aedes albopictus (speciesKey=1651430) — moustique tigre
- Aedes aegypti (speciesKey=1651228) — fievre jaune
- Culex pipiens (speciesKey=1652259) — vecteur WNV
- Compte par pays europeen
- Sauvegarde dans processed/
"""

import requests
import json
import os
import time

PROCESSED_DIR = os.path.join(os.path.dirname(__file__), '..', 'processed')
GBIF_URL = "https://api.gbif.org/v1/occurrence/search"

SPECIES = {
    'aedes_albopictus': {'speciesKey': 1651430, 'name': 'Aedes albopictus'},
    'aedes_aegypti': {'speciesKey': 1651228, 'name': 'Aedes aegypti'},
    'culex_pipiens': {'speciesKey': 1652259, 'name': 'Culex pipiens'},
}

EUROPEAN_COUNTRIES = [
    'FR', 'IT', 'ES', 'GR', 'DE', 'PT', 'HR', 'RO', 'BG', 'HU',
    'AT', 'SI', 'SK', 'CZ', 'PL', 'BE', 'NL', 'CH', 'AL', 'RS',
    'BA', 'ME', 'MK', 'TR', 'CY', 'MT', 'SE', 'NO', 'DK', 'FI',
    'IE', 'GB', 'LU', 'EE', 'LV', 'LT',
]


def count_species_by_country(species_key, species_name):
    """Compte les observations d'une espece par pays europeen."""
    print(f"\n  {species_name} (speciesKey={species_key})")
    counts = {}

    for country in EUROPEAN_COUNTRIES:
        params = {
            'speciesKey': species_key,
            'country': country,
            'limit': 0,
        }
        try:
            resp = requests.get(GBIF_URL, params=params, timeout=10)
            resp.raise_for_status()
            count = resp.json().get('count', 0)
            if count > 0:
                counts[country] = count
        except Exception as e:
            print(f"    ERREUR {country}: {e}")
        time.sleep(0.1)  # Rate limiting

    # Afficher les resultats
    sorted_counts = sorted(counts.items(), key=lambda x: x[1], reverse=True)
    total = sum(counts.values())
    print(f"    Total: {total:,} observations dans {len(counts)} pays")
    for country, count in sorted_counts[:10]:
        print(f"    {country}: {count:,}")

    return counts


def fetch_recent_observations(species_key, country, limit=20):
    """Recupere les observations recentes pour un pays."""
    params = {
        'speciesKey': species_key,
        'country': country,
        'limit': limit,
        'orderBy': 'eventDate',
        'desc': 'true',
    }
    resp = requests.get(GBIF_URL, params=params, timeout=10)
    resp.raise_for_status()
    results = resp.json().get('results', [])

    observations = []
    for r in results:
        obs = {
            'species': r.get('species', ''),
            'lat': r.get('decimalLatitude'),
            'lon': r.get('decimalLongitude'),
            'date': r.get('eventDate', ''),
            'country': r.get('country', ''),
            'stateProvince': r.get('stateProvince', ''),
            'datasetName': r.get('datasetName', ''),
        }
        if obs['lat'] and obs['lon']:
            observations.append(obs)

    return observations


def main():
    os.makedirs(PROCESSED_DIR, exist_ok=True)

    print("Interrogation GBIF — Distribution des moustiques en Europe")
    print(f"{'='*60}")

    all_data = {}

    for key, spec in SPECIES.items():
        counts = count_species_by_country(spec['speciesKey'], spec['name'])
        all_data[key] = {
            'species_name': spec['name'],
            'speciesKey': spec['speciesKey'],
            'counts_by_country': counts,
            'total_observations': sum(counts.values()),
            'countries_with_presence': len(counts),
        }

    # Observations recentes pour les pays cles (Ae. albopictus)
    print(f"\n{'='*60}")
    print("  Observations recentes Ae. albopictus — pays cles")
    print(f"{'='*60}")

    sample_obs = {}
    for country in ['FR', 'IT', 'ES', 'GR']:
        obs = fetch_recent_observations(1651430, country, limit=5)
        sample_obs[country] = obs
        if obs:
            print(f"\n  {country} ({len(obs)} recentes):")
            for o in obs[:3]:
                print(f"    {o['date'][:10] if o['date'] else '?'} | {o['lat']:.2f}, {o['lon']:.2f} | {o['stateProvince']}")
        time.sleep(0.2)

    all_data['sample_observations'] = sample_obs

    # Resume
    print(f"\n{'='*60}")
    print("  RESUME")
    print(f"{'='*60}")
    for key, data in all_data.items():
        if key == 'sample_observations':
            continue
        print(f"  {data['species_name']}: {data['total_observations']:,} obs dans {data['countries_with_presence']} pays")

    # Sauvegarder
    outpath = os.path.join(PROCESSED_DIR, 'species_distribution_europe.json')
    with open(outpath, 'w') as f:
        json.dump(all_data, f, indent=2)
    print(f"\nSauvegarde: {outpath}")


if __name__ == '__main__':
    main()
