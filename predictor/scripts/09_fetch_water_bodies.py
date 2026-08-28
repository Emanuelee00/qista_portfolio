"""
Script 09 : Telecharger et analyser les donnees de zones en eau / humides.

Sources :
- GLWD Level 1 : grands lacs et reservoirs (>= 1 km2) — GeoJSON
- GLWD Level 2 : petits lacs et zones humides — GeoJSON
- Spatial join avec NUTS3 pour calculer la surface en eau par region

Le facteur eau est cle pour les gites larvaires de moustiques.
"""

import requests
import json
import os
import zipfile
import geopandas as gpd
import pandas as pd
import tempfile

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'geo')
PROCESSED_DIR = os.path.join(os.path.dirname(__file__), '..', 'processed')

GLWD1_URL = "https://raw.githubusercontent.com/datasets/glwd/main/json/glwd_1.geojson"
GLWD2_URL = "https://raw.githubusercontent.com/datasets/glwd/main/json/glwd_2.geojson.zip"


def download_glwd1():
    """Telecharge GLWD Level 1 (grands lacs et reservoirs)."""
    outpath = os.path.join(DATA_DIR, 'glwd_1.geojson')
    if os.path.exists(outpath):
        print(f"  GLWD1 deja present ({os.path.getsize(outpath)/1e6:.1f} Mo)")
        return outpath

    print(f"  Telechargement GLWD Level 1 (28 Mo)...")
    resp = requests.get(GLWD1_URL, timeout=120)
    resp.raise_for_status()
    with open(outpath, 'w') as f:
        f.write(resp.text)
    print(f"  OK: {outpath} ({os.path.getsize(outpath)/1e6:.1f} Mo)")
    return outpath


def download_glwd2():
    """Telecharge GLWD Level 2 (petits lacs et zones humides)."""
    outpath = os.path.join(DATA_DIR, 'glwd_2.geojson')
    if os.path.exists(outpath):
        print(f"  GLWD2 deja present ({os.path.getsize(outpath)/1e6:.1f} Mo)")
        return outpath

    print(f"  Telechargement GLWD Level 2 (30 Mo ZIP)...")
    zip_path = os.path.join(DATA_DIR, 'glwd_2.geojson.zip')
    resp = requests.get(GLWD2_URL, timeout=120)
    resp.raise_for_status()
    with open(zip_path, 'wb') as f:
        f.write(resp.content)

    # Extraire
    with zipfile.ZipFile(zip_path, 'r') as z:
        for name in z.namelist():
            if name.endswith('.geojson'):
                with z.open(name) as src, open(outpath, 'wb') as dst:
                    dst.write(src.read())
                break

    print(f"  OK: {outpath} ({os.path.getsize(outpath)/1e6:.1f} Mo)")
    return outpath


def load_water_europe(glwd1_path, glwd2_path):
    """Charge les donnees GLWD et filtre sur l'Europe."""
    print(f"\n  Chargement GLWD Level 1...")
    gdf1 = gpd.read_file(glwd1_path)
    print(f"    {len(gdf1)} plans d'eau mondiaux")
    print(f"    Colonnes: {list(gdf1.columns)}")

    # Filtrer Europe (lat 34-72, lon -25 a 45)
    gdf1_eu = gdf1.cx[-25:45, 34:72]
    print(f"    {len(gdf1_eu)} en Europe")

    print(f"\n  Chargement GLWD Level 2...")
    gdf2 = gpd.read_file(glwd2_path)
    print(f"    {len(gdf2)} plans d'eau mondiaux")

    gdf2_eu = gdf2.cx[-25:45, 34:72]
    print(f"    {len(gdf2_eu)} en Europe")

    # Combiner
    combined = pd.concat([gdf1_eu, gdf2_eu], ignore_index=True)
    print(f"\n  Total Europe: {len(combined)} plans d'eau / zones humides")
    return combined


def compute_water_index_by_nuts3(water_gdf, nuts3_gdf):
    """
    Calcule un indice de presence d'eau par region NUTS3.
    Methode : intersection des polygones eau x NUTS3, puis surface relative.
    """
    print(f"\n  Calcul de l'indice eau par NUTS3...")

    # Projeter en metres pour calculer les surfaces
    water_proj = water_gdf.to_crs('EPSG:3035')
    nuts3_proj = nuts3_gdf.to_crs('EPSG:3035')

    # Surface de chaque region NUTS3
    nuts3_proj['region_area_km2'] = nuts3_proj.geometry.area / 1e6

    # Intersection
    print("    Intersection spatiale (peut prendre un moment)...")
    try:
        intersection = gpd.overlay(water_proj, nuts3_proj[['geometry', 'NUTS_ID', 'region_area_km2']], how='intersection')
    except Exception as e:
        print(f"    ERREUR overlay: {e}")
        # Fallback : compter les plans d'eau par region via sjoin
        print("    Fallback: comptage par sjoin...")
        joined = gpd.sjoin(water_proj, nuts3_proj[['geometry', 'NUTS_ID']], how='inner', predicate='intersects')
        counts = joined.groupby('NUTS_ID').size()
        result = {nuts_id: {'water_bodies_count': int(count)} for nuts_id, count in counts.items()}
        return result

    # Surface d'eau par region
    intersection['water_area_km2'] = intersection.geometry.area / 1e6
    water_by_nuts = intersection.groupby('NUTS_ID').agg(
        water_area_km2=('water_area_km2', 'sum'),
        water_bodies_count=('water_area_km2', 'count'),
        region_area_km2=('region_area_km2', 'first'),
    )

    water_by_nuts['water_pct'] = (water_by_nuts['water_area_km2'] / water_by_nuts['region_area_km2'] * 100).round(2)

    result = {}
    for nuts_id, row in water_by_nuts.iterrows():
        result[nuts_id] = {
            'water_area_km2': round(row['water_area_km2'], 2),
            'water_bodies_count': int(row['water_bodies_count']),
            'water_pct': row['water_pct'],
        }

    print(f"    {len(result)} regions avec donnees eau")

    # Stats
    pcts = [v['water_pct'] for v in result.values()]
    counts = [v['water_bodies_count'] for v in result.values()]
    print(f"    % eau moyen: {sum(pcts)/len(pcts):.2f}%")
    print(f"    % eau max: {max(pcts):.2f}%")
    print(f"    Plans d'eau moy/region: {sum(counts)/len(counts):.1f}")

    # Top 15 regions les plus humides
    top = sorted(result.items(), key=lambda x: x[1]['water_pct'], reverse=True)[:15]
    print(f"\n    Top 15 regions les plus humides:")
    for nuts_id, data in top:
        print(f"      {nuts_id}: {data['water_pct']}% eau ({data['water_bodies_count']} plans d'eau, {data['water_area_km2']} km2)")

    return result


def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(PROCESSED_DIR, exist_ok=True)

    print("=" * 60)
    print("  GLWD — Global Lakes and Wetlands Database")
    print("=" * 60)

    # Telecharger
    glwd1_path = download_glwd1()
    glwd2_path = download_glwd2()

    # Charger et filtrer Europe
    water_gdf = load_water_europe(glwd1_path, glwd2_path)

    # Charger NUTS3
    nuts3_path = os.path.join(DATA_DIR, 'nuts3_europe_20m.geojson')
    nuts3_gdf = gpd.read_file(nuts3_path)

    # Calculer l'indice eau par NUTS3
    water_index = compute_water_index_by_nuts3(water_gdf, nuts3_gdf)

    # Sauvegarder
    outpath = os.path.join(PROCESSED_DIR, 'water_index_by_nuts3.json')
    with open(outpath, 'w') as f:
        json.dump(water_index, f, indent=2)
    print(f"\n  Sauvegarde: {outpath}")

    # Copier vers proto
    proto_path = os.path.join(os.path.dirname(__file__), '..', 'proto', 'public', 'data', 'water_index_by_nuts3.json')
    with open(proto_path, 'w') as f:
        json.dump(water_index, f, indent=2)
    print(f"  Copie proto: {proto_path}")


if __name__ == '__main__':
    main()
