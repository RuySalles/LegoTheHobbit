#!/usr/bin/env python3
"""Valida os dados do site antes de publicar.

Uso:
    python tools/validate.py          # verifica tudo (roda também no GitHub a cada push)
    python tools/validate.py --lock   # registra IDs novos em data/ids.lock.json

Só usa a biblioteca padrão do Python.
"""
import json, re, sys
from datetime import date
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')  # acentos no console do Windows
ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'data'
LOCK = DATA / 'ids.lock.json'
errors, warnings = [], []

def err(msg): errors.append(msg)
def warn(msg): warnings.append(msg)

def load(name):
    p = DATA / name
    try:
        return json.loads(p.read_text(encoding='utf-8'))
    except json.JSONDecodeError as e:
        err(f'{name}: JSON inválido na linha {e.lineno}, coluna {e.colno}: {e.msg}')
    except FileNotFoundError:
        err(f'{name}: arquivo não encontrado')
    return None

ALLOWED_TAGS = {'em', 'strong', 'b', 'a', 'br'}
def check_html(where, text):
    """Campos de texto aceitam HTML simples; confere se as tags estão fechadas e são permitidas."""
    if not isinstance(text, str) or not text.strip():
        err(f'{where}: texto vazio'); return
    for tag in re.findall(r'</?\s*([a-zA-Z0-9]+)', text):
        if tag.lower() not in ALLOWED_TAGS:
            err(f'{where}: tag <{tag}> não permitida (use só {", ".join(sorted(ALLOWED_TAGS))})')
    for tag in ALLOWED_TAGS - {'br'}:
        opened = len(re.findall(rf'<{tag}(\s[^>]*)?>', text)); closed = text.count(f'</{tag}>')
        if opened != closed:
            err(f'{where}: <{tag}> aberto {opened}x e fechado {closed}x')

# ---------------------------------------------------------------- rota
TAG_TYPES = {'custo', 'esquema', 'forja', 'entrega', 'prereq'}
def check_rota(d):
    ids = []
    mats = {m.get('key') for m in d.get('materials', [])}
    if 'mithril' not in mats: err('rota.json: o catálogo "materials" precisa ter a chave "mithril"')
    for i, m in enumerate(d.get('materials', [])):
        if not m.get('key') or not m.get('name'): err(f'rota.json materials[{i}]: precisa de "key" e "name"')
    if not d.get('stages'): err('rota.json: nenhuma etapa em "stages"')
    for si, st in enumerate(d.get('stages', []), 1):
        w = f'rota.json etapa {si:02d} ("{st.get("title", "?")}")'
        for f in ('title', 'subtitle', 'tag'):
            if not st.get(f): err(f'{w}: campo "{f}" obrigatório')
        if st.get('note'): check_html(f'{w} note', st['note'])
        if 'part' in st:
            if not (isinstance(st['part'], dict) and st['part'].get('title') and st['part'].get('text')): err(f'{w}: "part" precisa de "title" e "text"')
            else: check_html(f'{w} part', st['part']['text'])
        if not st.get('tasks'): err(f'{w}: etapa sem tarefas')
        for t in st.get('tasks', []):
            tid = t.get('id', '?'); tw = f'{w} tarefa {tid}'
            if not re.fullmatch(r't\d+', str(tid)): err(f'{tw}: id deve ser "t" + número (ex.: t38)')
            ids.append(tid)
            check_html(f'{tw} title', t.get('title')); check_html(f'{tw} desc', t.get('desc'))
            for m in t.get('materials', []):
                if not (isinstance(m, list) and len(m) == 2 and m[0] in mats and isinstance(m[1], int) and m[1] > 0):
                    err(f'{tw}: material inválido {m} (formato ["chave", quantidade]; chaves: {", ".join(sorted(mats))})')
            for g in t.get('tags', []):
                if not g.get('text'): err(f'{tw}: etiqueta sem "text"')
                if g.get('type') and g['type'] not in TAG_TYPES: err(f'{tw}: tipo de etiqueta "{g["type"]}" inválido ({", ".join(sorted(TAG_TYPES))})')
    dup = sorted({x for x in ids if ids.count(x) > 1})
    if dup: err(f'rota.json: ids de tarefa repetidos: {", ".join(dup)}')
    idset = set(ids)
    for b in d.get('redBricks', []):
        w = f'rota.json redBricks "{b.get("name", "?")}"'
        for f in ('label', 'name', 'tableName', 'item', 'quest', 'where', 'unlock'):
            if not b.get(f): err(f'{w}: campo "{f}" obrigatório')
        if not isinstance(b.get('cost'), int) or b['cost'] <= 0: err(f'{w}: "cost" deve ser um número inteiro de studs')
        if b.get('unlock') not in idset: err(f'{w}: "unlock" aponta para "{b.get("unlock")}", que não existe')
        if not isinstance(b.get('multiplier'), bool): err(f'{w}: "multiplier" deve ser true ou false')
        if 'group' in b and not b['group']: err(f'{w}: "group" não pode ficar vazio (remova o campo para a rota principal)')
    for i, s in enumerate(d.get('sources', [])): check_html(f'rota.json sources[{i}]', s)
    for i, s in enumerate(d.get('confirm', [])): check_html(f'rota.json confirm[{i}]', s)
    return ids

# ---------------------------------------------------------- conquistas
def check_conquistas(d):
    ach = d.get('achievements', {})
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', str(d.get('updated', ''))): err('conquistas.json: "updated" deve ser AAAA-MM-DD')
    else:
        try: date.fromisoformat(d['updated'])
        except ValueError: err('conquistas.json: "updated" não é uma data válida')
    if '{pct100}' not in d.get('intro', ''): warn('conquistas.json: "intro" não usa {pct100}')
    for i, x in enumerate(d.get('sources', [])): check_html(f'conquistas.json sources[{i}]', x)
    seen = []
    for c in d.get('chapters', []):
        for f in ('id', 'title', 'subtitle'):
            if not c.get(f): err(f'conquistas.json capítulo: campo "{f}" obrigatório')
        for a in c.get('achievements', []):
            if a not in ach: err(f'conquistas.json capítulo "{c.get("id")}": conquista "{a}" não existe em "achievements"')
            seen.append(a)
    dup = sorted({x for x in seen if seen.count(x) > 1})
    if dup: err(f'conquistas.json: conquistas em mais de um capítulo: {", ".join(dup)}')
    missing = sorted(set(ach) - set(seen))
    if missing: err(f'conquistas.json: conquistas fora de qualquer capítulo: {", ".join(missing)}')
    for aid, a in ach.items():
        w = f'conquistas.json {aid}'
        check_html(f'{w} name', a.get('name')); check_html(f'{w} desc', a.get('desc')); check_html(f'{w} tip', a.get('tip'))
        if a.get('rota'): check_html(f'{w} rota', a['rota'])
        if not isinstance(a.get('pct'), (int, float)) or not 0 <= a['pct'] <= 100: err(f'{w}: "pct" deve estar entre 0 e 100')
        if not (ROOT / 'assets' / 'achievements' / f'{aid.lower()}.jpg').is_file(): err(f'{w}: ícone assets/achievements/{aid.lower()}.jpg não encontrado')
    return list(ach)

# ---------------------------------------------------------------- main
def main():
    rota, conq = load('rota.json'), load('conquistas.json')
    ids = {'rota': check_rota(rota) if rota else [], 'conquistas': check_conquistas(conq) if conq else []}
    for f in ['index.html', 'conquistas.html', 'favicon.svg', 'assets/css/base.css', 'assets/js/lib/util.js', 'assets/js/lib/layout.js', 'assets/js/lib/checklist.js', 'assets/js/theme-init.js']:
        if not (ROOT / f).is_file(): err(f'arquivo obrigatório ausente: {f}')

    # Trava de IDs: um id publicado nunca pode sumir (apagaria o progresso salvo de quem usa o site).
    lock = json.loads(LOCK.read_text(encoding='utf-8')) if LOCK.is_file() else {'rota': [], 'conquistas': []}
    if '--lock' in sys.argv and not errors:
        for k in ids: lock[k] = sorted(set(lock.get(k, [])) | set(ids[k]), key=lambda x: (len(x), x))
        LOCK.write_text(json.dumps(lock, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
        print(f'IDs registrados em {LOCK.relative_to(ROOT)}.')
    retired = lock.get('aposentados', {})
    for k in ids:
        back = sorted(set(retired.get(k, [])) & set(ids[k]))
        if back: err(f'{k}: IDs aposentados não podem ser reutilizados: {", ".join(back)}. Use o próximo número livre.')
        gone = sorted(set(lock.get(k, [])) - set(ids[k]) - set(retired.get(k, [])))
        if gone: err(f'{k}: IDs publicados que sumiram: {", ".join(gone)}. Não apague nem renomeie IDs; se a tarefa não vale mais, mude o texto ou aposente o id (veja o README).')
        new = sorted(set(ids[k]) - set(lock.get(k, [])))
        if new: err(f'{k}: IDs novos ainda não registrados: {", ".join(new)}. Rode "python tools/validate.py --lock" ou adicione-os em data/ids.lock.json.')

    for w in warnings: print('AVISO:', w)
    if errors:
        print(f'\n{len(errors)} problema(s) encontrado(s):')
        for e in errors: print(' -', e)
        sys.exit(1)
    print(f'OK: {len(ids["rota"])} tarefas da rota e {len(ids["conquistas"])} conquistas verificadas.')

if __name__ == '__main__':
    main()
