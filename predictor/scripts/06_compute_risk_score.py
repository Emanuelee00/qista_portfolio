"""
Script 6 : Calcul du MosqRisk Score par pays.
Croise toutes les sources pour generer un score S+C+D+O par pays.

Score total /100 -> Classe A (faible) a E (critique)
- S (Especes)      0-25 : presence/densite d'Aedes albopictus
- C (Climat)       0-25 : favorabilite meteo estivale
- D (Maladie)      0-25 : historique de cas de maladies vectorielles
- O (Observations) 0-25 : densite de signalements citoyens

Utilise les fichiers generes par les scripts 01-05.
"""

import json
import os

PROCESSED_DIR = os.path.join(os.path.dirname(__file__), '..', 'processed')


def load_json(filename):
    filepath = os.path.join(PROCESSED_DIR, filename)
    if not os.path.exists(filepath):
        print(f"  ATTENTION: {filepath} non trouve")
        return None
    with open(filepath) as f:
        return json.load(f)


def score_species(species_data, country_code):
    """
    Score S (0-25): presence et densite d'Aedes albopictus.
    - 0 obs = 0
    - 1-100 obs = 5 (introduit)
    - 100-500 = 10 (present)
    - 500-2000 = 15 (etabli)
    - 2000-5000 = 20 (tres etabli)
    - 5000+ = 25 (endemique)
    """
    if not species_data:
        return 0

    albopictus = species_data.get('aedes_albopictus', {})
    counts = albopictus.get('counts_by_country', {})
    count = counts.get(country_code, 0)

    if count == 0:
        return 0
    elif count < 100:
        return 5
    elif count < 500:
        return 10
    elif count < 2000:
        return 15
    elif count < 5000:
        return 20
    else:
        return 25


def score_climate(climate_data, city_key):
    """
    Score C (0-25): favorabilite meteo estivale.
    Basee sur l'indice de favorabilite moyen en ete 2024.
    - favorabilite 0-20 = 0-5
    - favorabilite 20-35 = 5-12
    - favorabilite 35-45 = 12-18
    - favorabilite 45-60 = 18-22
    - favorabilite 60+ = 22-25
    """
    if not climate_data or city_key not in climate_data:
        return 0

    fav = climate_data[city_key]['summer_2024']['avg_favorability_summer']

    if fav >= 60:
        return 25
    elif fav >= 45:
        return 18 + (fav - 45) * (7 / 15)
    elif fav >= 35:
        return 12 + (fav - 35) * (6 / 10)
    elif fav >= 20:
        return 5 + (fav - 20) * (7 / 15)
    else:
        return fav * (5 / 20)


def score_disease(disease_data, country_code):
    """
    Score D (0-25): cas de maladies vectorielles recents.
    Combine WNV (poids 2x) + dengue + chikungunya.
    Basee sur les taux de notification les plus recents.
    """
    if not disease_data:
        return 0

    total_score = 0

    # WNV — poids fort (transmission locale par moustiques europeens)
    wnv = disease_data.get('wnv', {}).get(country_code, {})
    # Prendre l'annee la plus recente avec des cas
    wnv_cases = 0
    for year in ['2024', '2023', '2022']:
        if year in wnv and wnv[year] > 0:
            wnv_cases = wnv[year]
            break

    if wnv_cases >= 200:
        total_score += 12
    elif wnv_cases >= 50:
        total_score += 8
    elif wnv_cases >= 10:
        total_score += 5
    elif wnv_cases >= 1:
        total_score += 2

    # Dengue — cas (surtout importes, mais autochtones en hausse)
    dengue = disease_data.get('dengue', {}).get(country_code, {})
    dengue_cases = 0
    for year in ['2024', '2023', '2022']:
        if year in dengue and dengue[year] > 0:
            dengue_cases = dengue[year]
            break

    if dengue_cases >= 1000:
        total_score += 8
    elif dengue_cases >= 200:
        total_score += 5
    elif dengue_cases >= 50:
        total_score += 3
    elif dengue_cases >= 1:
        total_score += 1

    # Chikungunya
    chik = disease_data.get('chikungunya', {}).get(country_code, {})
    chik_cases = 0
    for year in ['2024', '2023', '2022']:
        if year in chik and chik[year] > 0:
            chik_cases = chik[year]
            break

    if chik_cases >= 50:
        total_score += 5
    elif chik_cases >= 10:
        total_score += 3
    elif chik_cases >= 1:
        total_score += 1

    return min(25, total_score)


ISO2_TO_ISO3 = {
    'FR': 'FRA', 'IT': 'ITA', 'ES': 'ESP', 'EL': 'GRC', 'DE': 'DEU',
    'HR': 'HRV', 'RO': 'ROU', 'BG': 'BGR', 'HU': 'HUN', 'AT': 'AUT',
    'PT': 'PRT', 'SI': 'SVN', 'RS': 'SRB', 'AL': 'ALB', 'TR': 'TUR',
    'CY': 'CYP', 'MT': 'MLT', 'BE': 'BEL', 'NL': 'NLD', 'PL': 'POL',
    'CZ': 'CZE', 'SK': 'SVK',
}


def score_observations(mosquito_alert_data, country_code):
    """
    Score O (0-25): signalements citoyens Mosquito Alert.
    """
    if not mosquito_alert_data:
        return 0

    by_country = mosquito_alert_data.get('by_country', {})
    iso3 = ISO2_TO_ISO3.get(country_code, country_code)
    count = by_country.get(iso3, by_country.get(country_code, 0))

    if count >= 10000:
        return 25
    elif count >= 5000:
        return 20
    elif count >= 1000:
        return 15
    elif count >= 500:
        return 10
    elif count >= 100:
        return 5
    elif count > 0:
        return 2
    else:
        return 0


def risk_class(total_score):
    """Convertit un score /100 en classe A-E."""
    if total_score >= 80:
        return 'E'
    elif total_score >= 60:
        return 'D'
    elif total_score >= 40:
        return 'C'
    elif total_score >= 20:
        return 'B'
    else:
        return 'A'


# Mapping villes -> pays pour le score climat
CITY_COUNTRY_MAP = {
    'FR': 'marseille',  # Ville representante pour la France
    'IT': 'rome',
    'ES': 'barcelona',
    'EL': 'athens',
    'DE': 'munich',
}


def main():
    print("MosqRisk Score — Calcul par pays")
    print(f"{'='*70}")

    # Charger les donnees
    species_data = load_json('species_distribution_europe.json')
    climate_data = load_json('climate_data_cities.json')
    disease_data = load_json('disease_cases_by_country.json')
    mosquito_alert = load_json('mosquito_alert_stats.json')

    # Pays a scorer
    countries = {
        'FR': 'France', 'IT': 'Italie', 'ES': 'Espagne',
        'EL': 'Grece', 'DE': 'Allemagne', 'HR': 'Croatie',
        'RO': 'Roumanie', 'BG': 'Bulgarie', 'HU': 'Hongrie',
        'AT': 'Autriche', 'PT': 'Portugal', 'SI': 'Slovenie',
        'RS': 'Serbie', 'AL': 'Albanie', 'TR': 'Turquie',
        'CY': 'Chypre', 'MT': 'Malte', 'BE': 'Belgique',
        'NL': 'Pays-Bas', 'PL': 'Pologne', 'CZ': 'Tchequie',
        'SK': 'Slovaquie',
    }

    results = {}
    for code, name in countries.items():
        s = score_species(species_data, code)
        c = score_climate(climate_data, CITY_COUNTRY_MAP.get(code))
        d = score_disease(disease_data, code)
        o = score_observations(mosquito_alert, code)
        total = s + c + d + o
        cls = risk_class(total)

        results[code] = {
            'country_name': name,
            'score_species': s,
            'score_climate': c,
            'score_disease': d,
            'score_observations': o,
            'total_score': total,
            'risk_class': cls,
        }

    # Affichage
    print(f"\n{'Pays':<15} {'S':>3} {'C':>3} {'D':>3} {'O':>3} {'Total':>6} {'Classe':>6}")
    print("-" * 50)
    ranked = sorted(results.items(), key=lambda x: x[1]['total_score'], reverse=True)
    for code, r in ranked:
        print(f"{r['country_name']:<15} {r['score_species']:>3} {r['score_climate']:>3} {r['score_disease']:>3} {r['score_observations']:>3} {r['total_score']:>5}/100 {r['risk_class']:>5}")

    # Distribution des classes
    print(f"\n{'='*70}")
    print("  Distribution des classes de risque")
    print(f"{'='*70}")
    for cls in ['E', 'D', 'C', 'B', 'A']:
        cls_countries = [r['country_name'] for _, r in ranked if r['risk_class'] == cls]
        if cls_countries:
            print(f"  Classe {cls}: {', '.join(cls_countries)}")

    # Sauvegarder
    outpath = os.path.join(PROCESSED_DIR, 'risk_score_by_country.json')
    with open(outpath, 'w') as f:
        json.dump(results, f, indent=2)
    print(f"\nSauvegarde: {outpath}")


if __name__ == '__main__':
    main()
