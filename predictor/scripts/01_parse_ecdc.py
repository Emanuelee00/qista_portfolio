"""
Script 1 : Parser les 4 CSV ECDC et generer des fichiers nettoyes.
- West Nile Virus, Dengue, Chikungunya, Malaria
- Filtre sur les cas declares (Reported cases) par pays et par an
- Exclut les agregats EU/EEA
- Sauvegarde dans processed/
"""

import pandas as pd
import json
import os

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'ecdc')
PROCESSED_DIR = os.path.join(os.path.dirname(__file__), '..', 'processed')

# Codes agregats a exclure (pas des pays)
AGGREGATE_CODES = {
    'EU27_21', 'EU27_UK_21', 'EUEEA30_21', 'EUEEAUK_21',
    'EU28', 'EU27', 'EEA30', 'EEA31'
}

FILES = {
    'wnv': ('wnv_cases_europe.csv', 'West Nile virus infection'),
    'dengue': ('dengue_cases_europe.csv', 'Dengue'),
    'chikungunya': ('chikungunya_cases_europe.csv', 'Chikungunya virus disease'),
    'malaria': ('malaria_cases_europe.csv', 'Malaria'),
}


def parse_ecdc_csv(filepath, disease_name):
    """Parse un CSV ECDC et retourne un DataFrame nettoye."""
    df = pd.read_csv(filepath)
    print(f"\n{'='*60}")
    print(f"  {disease_name}")
    print(f"{'='*60}")
    print(f"  Lignes brutes: {len(df)}")
    print(f"  Colonnes: {list(df.columns)}")
    print(f"  Indicateurs: {df['Indicator'].unique()}")
    print(f"  Annees: {sorted(df['Time'].unique())}")

    # Filtrer : cas declares uniquement, exclure agregats
    cases = df[
        (df['Indicator'] == 'Reported cases') &
        (~df['RegionCode'].isin(AGGREGATE_CODES))
    ].copy()

    # Nettoyer
    cases['NumValue'] = pd.to_numeric(cases['NumValue'], errors='coerce').fillna(0)
    cases['Year'] = cases['Time'].astype(int)
    cases = cases[['Year', 'RegionCode', 'RegionName', 'NumValue', 'Population']].copy()
    cases.columns = ['year', 'country_code', 'country_name', 'cases', 'population']

    print(f"  Lignes apres filtre (Reported cases, pays): {len(cases)}")
    print(f"  Pays: {sorted(cases['country_code'].unique())}")
    print(f"  Periode: {cases['year'].min()}-{cases['year'].max()}")

    # Top 10 pays cumules
    top = cases.groupby('country_name')['cases'].sum().sort_values(ascending=False).head(10)
    print(f"\n  Top 10 pays (cas cumules):")
    for country, total in top.items():
        print(f"    {country}: {int(total):,}")

    return cases


def parse_rates(filepath, disease_name):
    """Parse les taux de notification par pays."""
    df = pd.read_csv(filepath)
    rates = df[
        (df['Indicator'] == 'Notification rate') &
        (~df['RegionCode'].isin(AGGREGATE_CODES))
    ].copy()
    rates['NumValue'] = pd.to_numeric(rates['NumValue'], errors='coerce').fillna(0)
    rates['Year'] = rates['Time'].astype(int)
    rates = rates[['Year', 'RegionCode', 'RegionName', 'NumValue']].copy()
    rates.columns = ['year', 'country_code', 'country_name', 'rate_per_100k']
    return rates


def main():
    os.makedirs(PROCESSED_DIR, exist_ok=True)
    all_cases = {}
    all_rates = {}

    for key, (filename, disease_name) in FILES.items():
        filepath = os.path.join(DATA_DIR, filename)
        if not os.path.exists(filepath):
            print(f"SKIP: {filepath} not found")
            continue

        cases = parse_ecdc_csv(filepath, disease_name)
        rates = parse_rates(filepath, disease_name)
        all_cases[key] = cases
        all_rates[key] = rates

    # Generer disease_cases_by_country.json
    # Structure: { "wnv": { "FR": { "2024": 5, "2023": 3 }, ... }, ... }
    output = {}
    for key, cases in all_cases.items():
        disease_data = {}
        for _, row in cases.iterrows():
            code = row['country_code']
            year = str(row['year'])
            if code not in disease_data:
                disease_data[code] = {}
            disease_data[code][year] = int(row['cases'])
        output[key] = disease_data

    outpath = os.path.join(PROCESSED_DIR, 'disease_cases_by_country.json')
    with open(outpath, 'w') as f:
        json.dump(output, f, indent=2)
    print(f"\n\nSauvegarde: {outpath}")

    # Generer disease_rates_by_country.json (taux /100k)
    output_rates = {}
    for key, rates in all_rates.items():
        disease_data = {}
        for _, row in rates.iterrows():
            code = row['country_code']
            year = str(row['year'])
            if code not in disease_data:
                disease_data[code] = {}
            disease_data[code][year] = round(row['rate_per_100k'], 4)
        output_rates[key] = disease_data

    outpath_rates = os.path.join(PROCESSED_DIR, 'disease_rates_by_country.json')
    with open(outpath_rates, 'w') as f:
        json.dump(output_rates, f, indent=2)
    print(f"Sauvegarde: {outpath_rates}")

    # Resume final
    print(f"\n{'='*60}")
    print("  RESUME")
    print(f"{'='*60}")
    total_cases = sum(
        cases['cases'].sum() for cases in all_cases.values()
    )
    print(f"  Total cas toutes maladies: {int(total_cases):,}")
    for key, cases in all_cases.items():
        latest_year = cases['year'].max()
        latest = cases[cases['year'] == latest_year]['cases'].sum()
        print(f"  {key.upper()} ({latest_year}): {int(latest):,} cas")


if __name__ == '__main__':
    main()
