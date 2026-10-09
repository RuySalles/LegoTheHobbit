#!/usr/bin/env python3
"""Atualiza as porcentagens globais das conquistas em data/conquistas.json a partir da Steam.

Uso:
    python tools/update_steam.py           # atualiza o arquivo (só grava se algo mudou)
    python tools/update_steam.py --check   # só mostra o que mudaria

O que muda: "pct" de cada conquista e a data "updated".
O que NÃO muda: nomes, descrições, dicas e capítulos (escritos à mão).
Conquistas novas na Steam são apenas avisadas, para alguém escrever a dica e escolher o capítulo.

Usa a API pública da Steam (não precisa de chave) e só a biblioteca padrão do Python.
"""
import json, sys, urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parent.parent
FILE = ROOT / 'data' / 'conquistas.json'
API = 'https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/?gameid={appid}'

def main():
    data = json.loads(FILE.read_text(encoding='utf-8'))
    url = API.format(appid=data['steamAppId'])
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'hobbit-guide-updater'}), timeout=30) as r:
        api = json.load(r)['achievementpercentages']['achievements']
    steam = {a['name']: round(float(a['percent']), 1) for a in api}
    if len(steam) < len(data['achievements']) // 2:
        sys.exit(f'Resposta da Steam suspeita ({len(steam)} conquistas); nada foi alterado.')

    changes = []
    for aid, a in data['achievements'].items():
        if aid not in steam:
            print(f'AVISO: {aid} não veio na resposta da Steam; mantendo {a["pct"]}%.')
            continue
        if steam[aid] != a['pct']:
            changes.append(f'{aid}: {a["pct"]}% → {steam[aid]}%')
            a['pct'] = steam[aid]
    for aid in sorted(set(steam) - set(data['achievements'])):
        print(f'AVISO: conquista nova na Steam: {aid} ({steam[aid]}%). Adicione-a em data/conquistas.json com dica, capítulo e ícone.')

    if not changes:
        print('Nenhuma porcentagem mudou; arquivo mantido.')
        return
    print(f'{len(changes)} porcentagem(ns) mudaram:')
    for c in changes: print(' -', c)
    if '--check' in sys.argv:
        return
    data['updated'] = datetime.now(timezone.utc).date().isoformat()
    FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Gravado em {FILE.relative_to(ROOT)} (updated = {data["updated"]}).')

if __name__ == '__main__':
    main()
