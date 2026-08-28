"""
Script 13 : Exporter TOUTES les sources de donnees en CSV dans export_csv/.
Un fichier par source, avec headers clairs.
"""

import json
import csv
import os

PROCESSED = os.path.join(os.path.dirname(__file__), '..', 'processed')
DATA = os.path.join(os.path.dirname(__file__), '..', 'data')
PROTO = os.path.join(os.path.dirname(__file__), '..', '..', 'client', 'public', 'data')
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'export_csv')


def write_csv(filename, headers, rows):
    path = os.path.join(OUT, filename)
    with open(path, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(headers)
        w.writerows(rows)
    print(f"  {filename}: {len(rows)} lignes")


def load(filename, folder=PROCESSED):
    path = os.path.join(folder, filename)
    if not os.path.exists(path):
        path = os.path.join(PROTO, filename)
    with open(path) as f:
        return json.load(f)


def main():
    os.makedirs(OUT, exist_ok=True)
    print("=" * 60)
    print("  EXPORT CSV — toutes les sources")
    print("=" * 60)

    # ─── 1. Scores NUTS3 (fichier principal) ───
    scores = load('risk_score_by_nuts3.json')
    rows = []
    for nuts_id, d in scores.items():
        rows.append([
            nuts_id, d.get('name',''), d.get('country',''),
            d.get('lat',''), d.get('lon',''),
            d.get('s',0), d.get('c',0), d.get('d',0), d.get('o',0), d.get('w',0),
            d.get('total',0), d.get('risk_class',''),
            d.get('gbif_obs',0), d.get('ma_obs',0),
            d.get('density',''), d.get('water_pct',''), d.get('water_bodies',''),
        ])
    write_csv('01_risk_scores_nuts3.csv',
        ['nuts3_id','name','country','lat','lon','score_species','score_climate','score_disease','score_observations','score_water','total_score','risk_class','gbif_observations','mosquito_alert_obs','population_density','water_pct','water_bodies_count'],
        rows)

    # ─── 2. ECDC WNV ───
    ecdc_path = os.path.join(DATA, 'ecdc', 'wnv_cases_europe.csv')
    if os.path.exists(ecdc_path):
        import shutil
        shutil.copy(ecdc_path, os.path.join(OUT, '02_ecdc_wnv_cases.csv'))
        lines = sum(1 for _ in open(ecdc_path)) - 1
        print(f"  02_ecdc_wnv_cases.csv: {lines} lignes (copie directe)")

    # ─── 3. ECDC Dengue ───
    ecdc_path = os.path.join(DATA, 'ecdc', 'dengue_cases_europe.csv')
    if os.path.exists(ecdc_path):
        import shutil
        shutil.copy(ecdc_path, os.path.join(OUT, '03_ecdc_dengue_cases.csv'))
        lines = sum(1 for _ in open(ecdc_path)) - 1
        print(f"  03_ecdc_dengue_cases.csv: {lines} lignes")

    # ─── 4. ECDC Chikungunya ───
    ecdc_path = os.path.join(DATA, 'ecdc', 'chikungunya_cases_europe.csv')
    if os.path.exists(ecdc_path):
        import shutil
        shutil.copy(ecdc_path, os.path.join(OUT, '04_ecdc_chikungunya_cases.csv'))
        lines = sum(1 for _ in open(ecdc_path)) - 1
        print(f"  04_ecdc_chikungunya_cases.csv: {lines} lignes")

    # ─── 5. ECDC Malaria ───
    ecdc_path = os.path.join(DATA, 'ecdc', 'malaria_cases_europe.csv')
    if os.path.exists(ecdc_path):
        import shutil
        shutil.copy(ecdc_path, os.path.join(OUT, '05_ecdc_malaria_cases.csv'))
        lines = sum(1 for _ in open(ecdc_path)) - 1
        print(f"  05_ecdc_malaria_cases.csv: {lines} lignes")

    # ─── 6. Cas maladies par pays (processed) ───
    disease = load('disease_cases_by_country.json')
    rows = []
    for disease_name, countries in disease.items():
        for country, years in countries.items():
            for year, cases in years.items():
                rows.append([disease_name, country, year, cases])
    write_csv('06_disease_cases_by_country.csv',
        ['disease','country_code','year','cases'], rows)

    # ─── 7. Taux maladies par pays ───
    rates = load('disease_rates_by_country.json')
    rows = []
    for disease_name, countries in rates.items():
        for country, years in countries.items():
            for year, rate in years.items():
                rows.append([disease_name, country, year, rate])
    write_csv('07_disease_rates_by_country.csv',
        ['disease','country_code','year','rate_per_100k'], rows)

    # ─── 8. WHO Dengue Europe (mensuel) ───
    try:
        who = load('who_dengue_europe.json')
        rows = []
        for iso, years in who.items():
            if isinstance(years, dict) and 'total_cases' not in years:
                for year, data in years.items():
                    if isinstance(data, dict) and 'cases' in data:
                        rows.append([iso, year, data['cases'], data.get('deaths',0)])
                        for month, mcases in data.get('months', {}).items():
                            if mcases > 0:
                                rows.append([iso, f"{year}-{month.zfill(2)}", mcases, ''])
        write_csv('08_who_dengue_europe_monthly.csv',
            ['iso3','period','cases','deaths'], rows)
    except: print("  08_who_dengue: skip")

    # ─── 9. Climate data (8 villes) ───
    climate = load('climate_data_cities.json')
    rows = []
    for city, data in climate.items():
        s = data.get('summer_2024', {})
        rows.append([
            city, data.get('label',''), data.get('country',''),
            data.get('lat',''), data.get('lon',''),
            s.get('avg_temp_max',''), s.get('avg_temp_min',''),
            s.get('avg_humidity',''), s.get('total_precip',''),
            s.get('avg_favorability_summer',''), s.get('days_high_favorability',''),
        ])
    write_csv('09_climate_cities_summer2024.csv',
        ['city_key','city_name','country','lat','lon','avg_temp_max','avg_temp_min','avg_humidity','total_precip_mm','mosquito_favorability','high_fav_days'], rows)

    # ─── 10. Species distribution GBIF ───
    species = load('species_distribution_europe.json')
    rows = []
    for sp_key, sp_data in species.items():
        if sp_key == 'sample_observations': continue
        counts = sp_data.get('counts_by_country', {})
        for country, count in counts.items():
            rows.append([sp_data.get('species_name',''), sp_data.get('speciesKey',''), country, count])
    write_csv('10_gbif_species_by_country.csv',
        ['species','gbif_species_key','country_code','observation_count'], rows)

    # ─── 11. Mosquito Alert stats ───
    ma = load('mosquito_alert_stats.json')
    rows = []
    for key, val in ma.get('by_country', {}).items():
        rows.append([key, val])
    write_csv('11_mosquito_alert_by_country.csv',
        ['country_iso3','observation_count'], rows)

    by_year = ma.get('by_year', {})
    rows = [[y, c] for y, c in sorted(by_year.items())]
    write_csv('12_mosquito_alert_by_year.csv',
        ['year','observation_count'], rows)

    # ─── 12. Population NUTS3 ───
    pop = load('population_nuts3.json')
    rows = []
    for nuts_id, data in pop.items():
        rows.append([nuts_id, data.get('name',''), data.get('density','')])
    write_csv('13_population_density_nuts3.csv',
        ['nuts3_id','name','density_hab_km2'], rows)

    # ─── 13. Water index NUTS3 ───
    water = load('water_index_by_nuts3.json')
    rows = []
    for nuts_id, data in water.items():
        rows.append([nuts_id, data.get('water_area_km2',''), data.get('water_bodies_count',''), data.get('water_pct','')])
    write_csv('14_water_index_nuts3.csv',
        ['nuts3_id','water_area_km2','water_bodies_count','water_pct'], rows)

    # ─── 14. Tourism NUTS2 ───
    try:
        tourism = load('tourism_nuts2.json')
        rows = []
        for nuts2, data in tourism.items():
            rows.append([nuts2, data.get('name',''), data.get('nights_2023','')])
        write_csv('15_tourism_nuts2.csv',
            ['nuts2_id','name','nights_2023'], rows)
    except: print("  15_tourism: skip")

    # ─── 15. Risk trends ───
    try:
        trends = load('risk_trends.json')
        rows = []
        for country, years in trends.get('by_country', {}).items():
            for year, score in years.items():
                rows.append([country, year, score])
        write_csv('16_risk_trends_by_country.csv',
            ['country_code','year','avg_risk_score'], rows)
    except: print("  16_trends: skip")

    # ─── 16. Climate projections 2045 ───
    try:
        proj = load('climate_projections_2050.json')
        rows = []
        for city, data in proj.items():
            rows.append([city, data.get('name',''), data.get('current_summer_avg',''), data.get('projected_2045_avg', data.get('projected_2050_avg','')), data.get('delta','')])
        write_csv('17_climate_projections_2045.csv',
            ['city_key','city_name','current_summer_avg_C','projected_2045_avg_C','delta_C'], rows)
    except: print("  17_climate_proj: skip")

    # ─── 17. Alertes ───
    try:
        alerts = load('alerts.json')
        rows = []
        for a in alerts:
            rows.append([a.get('nuts_id',''), a.get('name',''), a.get('country',''), a.get('score',''), a.get('risk_class',''), a.get('type',''), a.get('message','')])
        write_csv('18_alerts.csv',
            ['nuts3_id','name','country','score','risk_class','alert_type','message'], rows)
    except: print("  18_alerts: skip")

    # ─── 18. Qista coverage ───
    try:
        cov = load('qista_coverage.json')
        rows = []
        for nuts_id, data in cov.items():
            rows.append([nuts_id, data.get('name',''), data.get('bornes_count',''), data.get('original_score',''), data.get('protected_score',''), data.get('reduction_pct',''), data.get('original_class',''), data.get('protected_class','')])
        write_csv('19_qista_coverage.csv',
            ['nuts3_id','name','bornes_count','original_score','protected_score','reduction_pct','original_class','protected_class'], rows)
    except: print("  19_qista_coverage: skip")

    # ─── 19. VectAbundance ───
    try:
        vect = load('vectabundance_points.json')
        rows = []
        for p in vect:
            rows.append([p.get('lat',''), p.get('lon',''), p.get('count',''), p.get('species',''), p.get('date',''), p.get('country','')])
        write_csv('20_vectabundance_ovitraps.csv',
            ['lat','lon','individual_count','species','date','country'], rows)
    except: print("  20_vectabundance: skip")

    # ─── 20. Bornes Qista ───
    try:
        bornes = load('qista_bornes.json', PROTO)
        rows = []
        for b in bornes:
            rows.append([b.get('id',''), b.get('lat',''), b.get('lon',''), b.get('name',''), b.get('city','')])
        write_csv('21_qista_bornes.csv',
            ['borne_id','lat','lon','name','city'], rows)
    except: print("  21_bornes: skip")

    # Resume
    files = sorted(os.listdir(OUT))
    total_size = sum(os.path.getsize(os.path.join(OUT, f)) for f in files)
    print(f"\n{'='*60}")
    print(f"  {len(files)} fichiers CSV generes dans export_csv/")
    print(f"  Taille totale: {total_size/1e6:.1f} Mo")
    print(f"{'='*60}")


if __name__ == '__main__':
    main()
