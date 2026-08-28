"""
Script 4 : Telecharger et explorer les donnees Mosquito Alert.
- Telecharge all_reports.zip depuis GitHub
- Extrait et analyse le contenu
- Compte les observations par espece, pays, annee
- Sauvegarde dans processed/
"""

import requests
import zipfile
import json
import os
import io
import pandas as pd

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'mosquito-alert')
PROCESSED_DIR = os.path.join(os.path.dirname(__file__), '..', 'processed')

ZIP_URL = "https://raw.githubusercontent.com/MosquitoAlert/Data/master/all_reports.zip"


def download_zip():
    """Telecharge le ZIP Mosquito Alert."""
    zip_path = os.path.join(DATA_DIR, 'all_reports.zip')
    if os.path.exists(zip_path):
        print(f"  ZIP deja present: {zip_path} ({os.path.getsize(zip_path) / 1e6:.1f} Mo)")
        return zip_path

    print(f"  Telechargement depuis GitHub ({ZIP_URL})...")
    resp = requests.get(ZIP_URL, stream=True, timeout=120)
    resp.raise_for_status()

    with open(zip_path, 'wb') as f:
        for chunk in resp.iter_content(chunk_size=8192):
            f.write(chunk)

    size_mb = os.path.getsize(zip_path) / 1e6
    print(f"  Telecharge: {zip_path} ({size_mb:.1f} Mo)")
    return zip_path


def explore_zip(zip_path):
    """Explore le contenu du ZIP."""
    print(f"\n  Contenu du ZIP:")
    with zipfile.ZipFile(zip_path, 'r') as z:
        for info in z.infolist():
            size_mb = info.file_size / 1e6
            print(f"    {info.filename} ({size_mb:.1f} Mo)")
        return z.namelist()


def parse_csv_from_zip(zip_path):
    """Parse les CSV contenus dans le ZIP."""
    import pandas as pd

    all_dfs = []
    with zipfile.ZipFile(zip_path, 'r') as z:
        json_files = sorted([f for f in z.namelist() if f.endswith('.json')])
        print(f"\n  Chargement de {len(json_files)} fichiers JSON annuels...")

        for jf_name in json_files:
            year = jf_name.split('all_reports')[-1].replace('.json', '')
            try:
                with z.open(jf_name) as jf:
                    data = json.load(jf)
                    if isinstance(data, list):
                        df = pd.DataFrame(data)
                        print(f"    {year}: {len(df):,} observations")
                        all_dfs.append(df)
                    elif isinstance(data, dict):
                        for key in data:
                            if isinstance(data[key], list):
                                df = pd.DataFrame(data[key])
                                print(f"    {year}: {len(df):,} observations")
                                all_dfs.append(df)
                                break
            except Exception as e:
                print(f"    {year}: ERREUR {e}")

    if not all_dfs:
        return None

    combined = pd.concat(all_dfs, ignore_index=True)
    print(f"\n  Total combine: {len(combined):,} observations")
    return combined


def analyze_data(df):
    """Analyse le DataFrame Mosquito Alert."""
    print(f"\n{'='*60}")
    print("  ANALYSE DES DONNEES MOSQUITO ALERT")
    print(f"{'='*60}")
    print(f"  Lignes: {len(df):,}")
    print(f"  Colonnes: {list(df.columns)}")
    print(f"\n  Types:")
    print(df.dtypes.to_string())
    print(f"\n  Apercu (5 premieres lignes):")
    print(df.head().to_string())

    # Chercher les colonnes pertinentes
    stats = {}

    # Especes
    species_col = None
    for col in ['species', 'tiger_mosquito_status', 'type', 'category', 'report_type',
                 'private_webserver_upload_species', 'ai_species']:
        if col in df.columns:
            species_col = col
            break

    if species_col:
        print(f"\n  Distribution par {species_col}:")
        counts = df[species_col].value_counts()
        print(counts.head(10).to_string())
        stats['species_distribution'] = counts.to_dict()

    # Coordonnees
    lat_col = lon_col = None
    for lat_name in ['lat', 'latitude', 'report_lat', 'y']:
        if lat_name in df.columns:
            lat_col = lat_name
            break
    for lon_name in ['lon', 'longitude', 'report_lon', 'x']:
        if lon_name in df.columns:
            lon_col = lon_name
            break

    if lat_col and lon_col:
        valid_coords = df[[lat_col, lon_col]].dropna()
        print(f"\n  Observations geolocalisees: {len(valid_coords):,}/{len(df):,}")
        stats['geolocated_count'] = len(valid_coords)

    # Dates
    date_col = None
    for col in ['date', 'creation_time', 'report_date', 'observation_date', 'created_at']:
        if col in df.columns:
            date_col = col
            break

    if date_col:
        df['_year'] = pd.to_datetime(df[date_col], errors='coerce').dt.year
        year_counts = df['_year'].value_counts().sort_index()
        print(f"\n  Observations par annee:")
        print(year_counts.to_string())
        stats['by_year'] = {str(int(k)): int(v) for k, v in year_counts.items() if not pd.isna(k)}

    # Pays (si disponible)
    country_col = None
    for col in ['country', 'country_code', 'nuts0']:
        if col in df.columns:
            country_col = col
            break

    if country_col:
        country_counts = df[country_col].value_counts()
        print(f"\n  Observations par pays:")
        print(country_counts.head(10).to_string())
        stats['by_country'] = country_counts.to_dict()

    return stats


def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(PROCESSED_DIR, exist_ok=True)

    print("Mosquito Alert — Telechargement et exploration")
    print(f"{'='*60}")

    # Telecharger
    zip_path = download_zip()

    # Explorer le ZIP
    filenames = explore_zip(zip_path)

    # Parser
    df = parse_csv_from_zip(zip_path)
    if df is None:
        print("  ERREUR: Impossible de parser les donnees du ZIP")
        return

    # Analyser
    stats = analyze_data(df)

    # Sauvegarder les stats
    outpath = os.path.join(PROCESSED_DIR, 'mosquito_alert_stats.json')
    with open(outpath, 'w') as f:
        json.dump(stats, f, indent=2, default=str)
    print(f"\nSauvegarde: {outpath}")


if __name__ == '__main__':
    main()
