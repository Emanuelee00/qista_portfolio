"""
Script 2 : Recuperer les donnees meteo Open-Meteo pour les 8 villes test.
- Previsions 7 jours (temperature, humidite, precipitations)
- Historique ete 2024 (juin-septembre)
- Calcul d'un indice de favorabilite moustique
- Sauvegarde dans processed/
"""

import requests
import json
import os
from datetime import datetime

PROCESSED_DIR = os.path.join(os.path.dirname(__file__), '..', 'processed')

CITIES = {
    'marseille': {'lat': 43.30, 'lon': 5.37, 'label': 'Marseille', 'country': 'FR'},
    'hyeres': {'lat': 43.12, 'lon': 6.13, 'label': 'Hyeres', 'country': 'FR'},
    'lyon': {'lat': 45.76, 'lon': 4.83, 'label': 'Lyon', 'country': 'FR'},
    'toulouse': {'lat': 43.60, 'lon': 1.44, 'label': 'Toulouse', 'country': 'FR'},
    'rome': {'lat': 41.90, 'lon': 12.50, 'label': 'Rome', 'country': 'IT'},
    'athens': {'lat': 37.98, 'lon': 23.73, 'label': 'Athenes', 'country': 'EL'},
    'barcelona': {'lat': 41.39, 'lon': 2.17, 'label': 'Barcelone', 'country': 'ES'},
    'munich': {'lat': 48.14, 'lon': 11.58, 'label': 'Munich', 'country': 'DE'},
}

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"


def mosquito_favorability(temp, humidity, precip):
    """
    Calcule un indice de favorabilite moustique (0-100).
    - Temperature optimale : 20-35C (pic a 27C)
    - Humidite : >60% favorable
    - Precipitations : >2mm dans les 7 derniers jours = gites larvaires
    """
    # Score temperature (0-40)
    if 20 <= temp <= 35:
        # Pic a 27C
        temp_score = 40 - abs(temp - 27) * (40 / 8)
        temp_score = max(0, temp_score)
    elif 15 <= temp < 20:
        temp_score = (temp - 15) * (20 / 5)
    elif 35 < temp <= 40:
        temp_score = (40 - temp) * (20 / 5)
    else:
        temp_score = 0

    # Score humidite (0-30)
    if humidity >= 80:
        hum_score = 30
    elif humidity >= 60:
        hum_score = 15 + (humidity - 60) * (15 / 20)
    elif humidity >= 40:
        hum_score = (humidity - 40) * (15 / 20)
    else:
        hum_score = 0

    # Score precipitations (0-30)
    if precip >= 20:
        precip_score = 30
    elif precip >= 5:
        precip_score = 15 + (precip - 5) * (15 / 15)
    elif precip >= 1:
        precip_score = (precip - 1) * (15 / 4)
    else:
        precip_score = 0

    return round(temp_score + hum_score + precip_score, 1)


def fetch_forecast(city_key, city):
    """Recupere les previsions 7 jours."""
    params = {
        'latitude': city['lat'],
        'longitude': city['lon'],
        'daily': 'temperature_2m_max,temperature_2m_min,temperature_2m_mean,relative_humidity_2m_mean,precipitation_sum',
        'forecast_days': 7,
        'timezone': 'Europe/Paris',
    }
    resp = requests.get(FORECAST_URL, params=params)
    resp.raise_for_status()
    data = resp.json()

    daily = data['daily']
    days = []
    for i in range(len(daily['time'])):
        temp_mean = daily['temperature_2m_mean'][i] or 0
        humidity = daily['relative_humidity_2m_mean'][i] or 0
        precip = daily['precipitation_sum'][i] or 0
        fav = mosquito_favorability(temp_mean, humidity, precip)
        days.append({
            'date': daily['time'][i],
            'temp_max': daily['temperature_2m_max'][i],
            'temp_min': daily['temperature_2m_min'][i],
            'temp_mean': temp_mean,
            'humidity_mean': humidity,
            'precipitation': precip,
            'mosquito_favorability': fav,
        })

    avg_fav = round(sum(d['mosquito_favorability'] for d in days) / len(days), 1)
    return {'days': days, 'avg_favorability_7d': avg_fav}


def fetch_summer_history(city_key, city):
    """Recupere l'historique ete 2024 (juin-septembre)."""
    params = {
        'latitude': city['lat'],
        'longitude': city['lon'],
        'daily': 'temperature_2m_max,temperature_2m_min,temperature_2m_mean,relative_humidity_2m_mean,precipitation_sum',
        'start_date': '2024-06-01',
        'end_date': '2024-09-30',
        'timezone': 'Europe/Paris',
    }
    resp = requests.get(ARCHIVE_URL, params=params)
    resp.raise_for_status()
    data = resp.json()

    daily = data['daily']
    favs = []
    for i in range(len(daily['time'])):
        temp = daily['temperature_2m_mean'][i] or 0
        hum = daily['relative_humidity_2m_mean'][i] or 0
        precip = daily['precipitation_sum'][i] or 0
        favs.append(mosquito_favorability(temp, hum, precip))

    return {
        'period': '2024-06 to 2024-09',
        'days_count': len(daily['time']),
        'avg_temp_max': round(sum(t for t in daily['temperature_2m_max'] if t) / len(daily['time']), 1),
        'avg_temp_min': round(sum(t for t in daily['temperature_2m_min'] if t) / len(daily['time']), 1),
        'avg_humidity': round(sum(h for h in daily['relative_humidity_2m_mean'] if h) / len(daily['time']), 1),
        'total_precip': round(sum(p for p in daily['precipitation_sum'] if p), 1),
        'avg_favorability_summer': round(sum(favs) / len(favs), 1),
        'days_high_favorability': sum(1 for f in favs if f >= 50),
    }


def main():
    os.makedirs(PROCESSED_DIR, exist_ok=True)
    results = {}

    print("Recuperation des donnees meteo Open-Meteo...")
    print(f"{'='*70}")

    for key, city in CITIES.items():
        print(f"\n  {city['label']} ({city['lat']}, {city['lon']})...")

        # Previsions
        forecast = fetch_forecast(key, city)
        print(f"    Previsions 7j: favorabilite moyenne = {forecast['avg_favorability_7d']}/100")

        # Historique ete
        summer = fetch_summer_history(key, city)
        print(f"    Ete 2024: favorabilite moyenne = {summer['avg_favorability_summer']}/100")
        print(f"    Ete 2024: {summer['days_high_favorability']} jours a haute favorabilite (>=50)")
        print(f"    Ete 2024: temp max moy {summer['avg_temp_max']}C, precip total {summer['total_precip']}mm")

        results[key] = {
            'label': city['label'],
            'country': city['country'],
            'lat': city['lat'],
            'lon': city['lon'],
            'forecast_7d': forecast,
            'summer_2024': summer,
        }

    # Classement par favorabilite estivale
    print(f"\n{'='*70}")
    print("  CLASSEMENT — Favorabilite moustique ete 2024")
    print(f"{'='*70}")
    ranked = sorted(results.items(), key=lambda x: x[1]['summer_2024']['avg_favorability_summer'], reverse=True)
    for i, (key, data) in enumerate(ranked, 1):
        fav = data['summer_2024']['avg_favorability_summer']
        high_days = data['summer_2024']['days_high_favorability']
        print(f"  {i}. {data['label']:15s}  {fav:5.1f}/100  ({high_days} jours >= 50)")

    # Sauvegarder
    outpath = os.path.join(PROCESSED_DIR, 'climate_data_cities.json')
    with open(outpath, 'w') as f:
        json.dump(results, f, indent=2)
    print(f"\nSauvegarde: {outpath}")


if __name__ == '__main__':
    main()
