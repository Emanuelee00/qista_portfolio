"""
Script 11 : Preparer les observations Mosquito Alert geolocalisees
en un JSON leger pour affichage sur la carte au zoom.
+ Extraire les plans d'eau GLWD en Europe comme GeoJSON simplifie.
"""

import json
import os
import zipfile

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
PROTO_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'client', 'public', 'data')


def extract_mosquito_alert_points():
    """Extrait les observations MA 2022-2026 en points legers."""
    zip_path = os.path.join(DATA_DIR, 'mosquito-alert', 'all_reports.zip')
    points = []

    with zipfile.ZipFile(zip_path, 'r') as z:
        for jf_name in sorted(f for f in z.namelist() if f.endswith('.json')):
            year = jf_name.split('all_reports')[-1].replace('.json', '')
            if not year.isdigit() or int(year) < 2022:
                continue
            print(f"  Lecture {year}...")
            with z.open(jf_name) as f:
                for obs in json.load(f):
                    lat = obs.get('lat')
                    lon = obs.get('lon')
                    typ = obs.get('type')
                    if lat and lon and typ == 'adult' and -30 < lon < 50 and 34 < lat < 72:
                        points.append([round(lat, 4), round(lon, 4)])

    print(f"  Total points adultes Europe 2022+: {len(points)}")

    # Sous-echantillonner si trop lourd (max 50k pour la perf frontend)
    if len(points) > 50000:
        import random
        random.seed(42)
        points = random.sample(points, 50000)
        print(f"  Sous-echantillonne a 50 000 points")

    return points


def extract_gbif_points():
    """Utilise les observations GBIF Aedes albopictus deja en processed."""
    species_path = os.path.join(os.path.dirname(__file__), '..', 'processed', 'species_distribution_europe.json')
    if not os.path.exists(species_path):
        return []

    with open(species_path) as f:
        data = json.load(f)

    # On n'a que les comptages par pays, pas les points individuels
    # Les points GBIF ont ete charges dans le script 08 mais pas sauvegardes
    # On va regenerer quelques points depuis l'API
    print("  Points GBIF: utilisation des donnees sample_observations")
    samples = data.get('sample_observations', {})
    points = []
    for country, obs_list in samples.items():
        for obs in obs_list:
            if obs.get('lat') and obs.get('lon'):
                points.append([round(obs['lat'], 4), round(obs['lon'], 4)])

    return points


def main():
    os.makedirs(PROTO_DIR, exist_ok=True)

    print("=" * 60)
    print("  Preparation des donnees de points pour le zoom carte")
    print("=" * 60)

    # 1. Mosquito Alert points
    print("\n  Mosquito Alert...")
    ma_points = extract_mosquito_alert_points()

    # 2. GBIF points (bonus)
    gbif_points = extract_gbif_points()
    print(f"  GBIF sample points: {len(gbif_points)}")

    # Combiner
    all_points = ma_points + gbif_points
    print(f"\n  Total points: {len(all_points)}")

    # Sauvegarder en format compact [lat, lon] array
    outpath = os.path.join(PROTO_DIR, 'observation_points.json')
    with open(outpath, 'w') as f:
        json.dump(all_points, f)

    size_mb = os.path.getsize(outpath) / 1e6
    print(f"  Sauvegarde: {outpath} ({size_mb:.1f} Mo)")


if __name__ == '__main__':
    main()
