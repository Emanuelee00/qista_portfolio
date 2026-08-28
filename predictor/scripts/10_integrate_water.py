"""
Script 10 : Integrer le facteur eau (GLWD) dans le MosqRisk Score.

Relit les scores NUTS3 existants et le water_index,
puis recalcule le score avec un facteur eau qui module C et ajoute un bonus.

Logique :
- Le score passe de S+C+D+O (4x25 = 100) a S+C+D+O+W (100 redistribue)
- W (Eau) : 0-15 pts base sur % eau + nombre de plans d'eau dans la region
- Les autres scores sont reponderes pour garder un total /100 :
  S: 0-22, C: 0-22, D: 0-22, O: 0-19, W: 0-15
"""

import json
import os

PROCESSED_DIR = os.path.join(os.path.dirname(__file__), '..', 'processed')


def compute_water_score(water_data):
    """Score W (0-15) : gites larvaires potentiels."""
    if not water_data:
        return 3  # fallback: pas de donnees = score neutre

    pct = water_data.get('water_pct', 0)
    count = water_data.get('water_bodies_count', 0)

    # % de surface en eau (0-10)
    if pct >= 10:
        pct_score = 10
    elif pct >= 5:
        pct_score = 7 + (pct - 5) * (3 / 5)
    elif pct >= 2:
        pct_score = 4 + (pct - 2) * (3 / 3)
    elif pct >= 0.5:
        pct_score = 1 + (pct - 0.5) * (3 / 1.5)
    elif pct > 0:
        pct_score = pct * 2
    else:
        pct_score = 0

    # Nombre de plans d'eau (0-5) — fragmentation = plus de gites
    if count >= 50:
        count_score = 5
    elif count >= 20:
        count_score = 4
    elif count >= 10:
        count_score = 3
    elif count >= 5:
        count_score = 2
    elif count >= 1:
        count_score = 1
    else:
        count_score = 0

    return min(15, round(pct_score + count_score))


def risk_class(total):
    if total >= 75: return 'E'
    if total >= 55: return 'D'
    if total >= 40: return 'C'
    if total >= 25: return 'B'
    return 'A'


def main():
    print("=" * 60)
    print("  Integration facteur EAU dans le MosqRisk Score")
    print("=" * 60)

    # Charger les scores existants
    with open(os.path.join(PROCESSED_DIR, 'risk_score_by_nuts3.json')) as f:
        scores = json.load(f)
    print(f"  Scores existants: {len(scores)} regions")

    # Charger l'index eau
    water_path = os.path.join(PROCESSED_DIR, 'water_index_by_nuts3.json')
    with open(water_path) as f:
        water_index = json.load(f)
    print(f"  Index eau: {len(water_index)} regions")

    # Recalculer les scores avec le facteur eau
    # Reponderation : S(22) + C(22) + D(22) + O(19) + W(15) = 100
    class_counts = {'A': 0, 'B': 0, 'C': 0, 'D': 0, 'E': 0}

    for nuts_id, data in scores.items():
        old_s = data['s']
        old_c = data['c']
        old_d = data['d']
        old_o = data['o']

        # Reponderer les anciens scores (etaient /25, passent a /22 ou /19)
        new_s = round(old_s * 22 / 25)
        new_c = round(old_c * 22 / 25)
        new_d = round(old_d * 22 / 25)
        new_o = round(old_o * 19 / 25)

        # Nouveau score eau
        water_data = water_index.get(nuts_id)
        w = compute_water_score(water_data)

        total = new_s + new_c + new_d + new_o + w
        cls = risk_class(total)
        class_counts[cls] += 1

        data['s'] = new_s
        data['c'] = new_c
        data['d'] = new_d
        data['o'] = new_o
        data['w'] = w
        data['total'] = total
        data['risk_class'] = cls
        if water_data:
            data['water_pct'] = water_data.get('water_pct', 0)
            data['water_bodies'] = water_data.get('water_bodies_count', 0)

    # Distribution
    print(f"\n  Distribution des classes (avec facteur eau):")
    for cls in ['E', 'D', 'C', 'B', 'A']:
        print(f"    {cls}: {class_counts[cls]} regions")

    # Top 25
    top = sorted(scores.items(), key=lambda x: x[1]['total'], reverse=True)[:25]
    print(f"\n  Top 25 regions a risque:")
    print(f"  {'NUTS3':<8} {'Nom':<28} {'S':>3} {'C':>3} {'D':>3} {'O':>3} {'W':>3} {'Tot':>4} {'Cls':>3}  Eau%")
    print("  " + "-" * 85)
    for nuts_id, r in top:
        wpct = f"{r.get('water_pct', 0):.1f}" if r.get('water_pct') else '-'
        print(f"  {nuts_id:<8} {r['name'][:28]:<28} {r['s']:>3} {r['c']:>3} {r['d']:>3} {r['o']:>3} {r['w']:>3} {r['total']:>4} {r['risk_class']:>3}  {wpct:>5}%")

    # Regions ou l'eau fait la difference (W >= 10)
    high_water = [(k, v) for k, v in scores.items() if v.get('w', 0) >= 10]
    high_water.sort(key=lambda x: x[1]['w'], reverse=True)
    print(f"\n  Regions avec fort facteur eau (W >= 10):")
    for nuts_id, r in high_water[:15]:
        print(f"    {nuts_id} {r['name'][:25]:<25} W={r['w']} ({r.get('water_pct', 0):.1f}% eau, {r.get('water_bodies', 0)} plans d'eau)")

    # Sauvegarder
    outpath = os.path.join(PROCESSED_DIR, 'risk_score_by_nuts3.json')
    with open(outpath, 'w') as f:
        json.dump(scores, f)
    print(f"\n  Sauvegarde: {outpath}")

    proto_path = os.path.join(os.path.dirname(__file__), '..', 'proto', 'public', 'data', 'risk_score_by_nuts3.json')
    with open(proto_path, 'w') as f:
        json.dump(scores, f)
    print(f"  Copie proto: {proto_path}")


if __name__ == '__main__':
    main()
