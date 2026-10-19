# LEGO The Hobbit — Middle-earth Field Guide

Guia comunitário com a **rota de multiplicadores de studs** (Red Bricks x2 a x10) e uma página extra de **conquistas da Steam**.

- Site: https://ruysalles.github.io/LegoTheHobbit/
- Conquistas: https://ruysalles.github.io/LegoTheHobbit/conquistas.html

O site é estático (GitHub Pages, sem build). O **conteúdo** fica em arquivos JSON e o **layout** em HTML/CSS/JS. Para mudar um texto, você só mexe no JSON.

## Estrutura

```
index.html              página da rota (só a "casca": topo, títulos fixos e recipientes vazios)
conquistas.html         página de conquistas (idem)
data/
  rota.json             ← conteúdo da rota: etapas, tarefas, materiais, Red Bricks, fontes
  conquistas.json       ← conteúdo das conquistas: capítulos, dicas, % da Steam
  ids.lock.json         IDs já publicados (proteção do progresso salvo; veja abaixo)
assets/
  css/base.css          cores (tokens dos temas claro/escuro), topo, menu, rodapé — comum às páginas
  css/rota.css          estilos só da rota
  css/conquistas.css    estilos só das conquistas
  js/theme-init.js      aplica o tema antes de pintar a tela (evita "piscar")
  js/common.js          tema, menu, salvamento, formatação de números
  js/rota.js            monta a rota a partir de data/rota.json + checklist
  js/conquistas.js      monta as conquistas a partir de data/conquistas.json + checklist
  achievements/*.jpg    ícones das conquistas (nome = id da Steam em minúsculas)
tools/
  validate.py           confere os dados (roda no GitHub a cada push)
  update_steam.py       atualiza as % das conquistas com a Steam (roda toda segunda no GitHub)
.github/workflows/      as duas automações acima
```

## ⚠️ Regra de ouro: nunca mude, apague ou reaproveite um ID

O progresso de cada visitante fica salvo no navegador dele, ligado ao **id** de cada item (`t1`, `t2`… na rota; `COMPLETE_STORYEVENT1`… nas conquistas).

- **Tarefa nova** → use o próximo número livre (hoje o maior é `t37`, então a próxima é `t38`), mesmo que ela fique no meio da rota. A ordem na tela é a ordem no JSON, não o número.
- **Tarefa que não vale mais** → de preferência, mude o texto e mantenha o id.
- **Tarefa que precisa sair** (ex.: várias juntadas numa só) → apague-a da rota e acrescente o id em `aposentados` no `data/ids.lock.json`. Quem tinha marcado essa tarefa só perde aquela marcação. Id aposentado nunca volta a ser usado (hoje: `t1`, `t9`, `t36`).
- O arquivo `data/ids.lock.json` lista todos os IDs já publicados. O validador **falha** se algum deles sumir sem estar em `aposentados`, se um id aposentado reaparecer, e também se aparecer um id novo que ainda não está na lista. Para registrar IDs novos, rode `python tools/validate.py --lock` (ou acrescente o id à lista à mão, pelo próprio GitHub).

As chaves de salvamento no navegador (`hobbit-route-checklist-v1`, `hobbit-achievements-v1`, `hobbit-theme`…) também nunca devem mudar.

## Como editar

Dá para editar direto no GitHub (abra o arquivo → ícone de lápis → "Commit changes"). O validador roda sozinho em seguida; se o check ficar vermelho, a mensagem diz o que corrigir.

Campos de texto aceitam HTML simples: `<em>`, `<strong>`, `<b>`, `<a href="...">` e `<br>`.

### Rota (`data/rota.json`)

**Adicionar uma tarefa** dentro da etapa certa, em `stages[...].tasks`:

```json
{
  "id": "t38",
  "title": "Fabrique o Mithril Exemplo",
  "desc": "Forje o item em <em>Bree</em>.",
  "materials": [["mithril", 5], ["madeira", 20]],
  "tags": [{ "text": "Forja · Bree", "type": "forja" }]
}
```

- `materials` (opcional): pares `["chave", quantidade]`. As chaves vêm do catálogo `materials` no topo do arquivo (`mithril`, `madeira`, `prata`, `paes`…). Para um material novo, acrescente-o ao catálogo.
- `tags`: `type` é opcional e muda a cor — `esquema` (azul), `forja` (laranja), `entrega` (verde), `prereq` (vermelho), `custo` (dourado).
- A **lista de materiais da rota**, o total de studs, os contadores e os números das etapas (01, 02…) são **calculados sozinhos**.

**Etapas** (`stages`): `title`, `subtitle`, `tag` e `tasks` são obrigatórios. `note` (opcional) mostra um aviso no topo da etapa. `"optional": "Nome"` marca a etapa como opcional: os materiais dela aparecem como "+N com Nome" na lista de materiais. `"part": {"title": "…", "text": "…"}` (opcional) põe um divisor antes da etapa, abrindo uma nova parte da rota (hoje: *O Tesouro de Erebor*, a partir da etapa 09).

> Textos que citam "etapa 05" etc. são escritos à mão: se você inserir uma etapa no meio, revise essas referências.

**Red Bricks** (`redBricks`): cada um aparece no painel do topo e na tabela de custos. `unlock` é o id da tarefa de entrega que acende o brick. `multiplier: true` conta no "custo dos multiplicadores". `group` (opcional) tira o brick da rota principal: ele vai para a lista recolhível do painel e para um bloco separado da tabela, com o nome da parte.

**Fontes** (`sources`) e **pontos a confirmar** (`confirm`): uma linha HTML por item.

### Conquistas (`data/conquistas.json`)

- `tip`: a dica de como conseguir (escrita à mão).
- `rota` (opcional): uma linha extra apontando para a rota.
- `name`, `desc`, `pct`, `solo`: vêm da Steam. **`pct` é atualizado automaticamente**; não precisa mexer.
- Capítulos: a lista `chapters[...].achievements` define a ordem e o agrupamento. Toda conquista precisa estar em exatamente um capítulo.

## Rodar localmente

As páginas carregam os JSON via `fetch`, então **não abrem com duplo clique** no arquivo. Use um servidor local, na pasta do projeto:

```bash
python -m http.server 8000
```

E abra http://localhost:8000. (No Windows, se `python` não existir, use `py`.)

Antes de commitar:

```bash
python tools/validate.py
```

## Automações (GitHub Actions)

| Workflow | Quando | O que faz |
|---|---|---|
| **Validar dados** | a cada push e pull request | roda `tools/validate.py` |
| **Atualizar porcentagens da Steam** | segundas, 06:00 (Brasília), ou manual pela aba *Actions* | roda `tools/update_steam.py`; se alguma % mudou, faz um commit e o Pages publica |

Se a atualização semanal falhar com erro de permissão, habilite em **Settings → Actions → General → Workflow permissions → Read and write permissions**.

## Visual

- Cores: tokens no topo de `assets/css/base.css` (um bloco para o tema escuro, outro para o claro). Mudar ali vale para todas as páginas.
- Fontes: Cinzel (títulos) e Alegreya (texto), via Google Fonts.
### Imagem de compartilhamento (WhatsApp, Discord…)

`og-image.jpg` (1200×630) é gerada a partir de `tools/og/og-image.html`, que lê os números (multiplicadores, studs, tarefas) de `data/rota.json`. Regenere quando esses números ou o visual mudarem:

1. Com o servidor local rodando (veja acima), gere o PNG com o Chrome:

   ```bash
   chrome --headless=new --hide-scrollbars --force-device-scale-factor=1 --window-size=1200,630 --virtual-time-budget=8000 --screenshot=og.png http://localhost:8000/tools/og/og-image.html
   ```

2. Converta para JPG (qualidade ~85) e salve como `og-image.jpg` na raiz. Mantenha abaixo de ~300 KB, ou o WhatsApp pode ignorar a imagem.
3. Para o WhatsApp buscar a imagem nova, mude o nome do arquivo (ex.: `og-image-2.jpg`) e atualize as tags `og:image`/`twitter:image` das duas páginas, ou teste com `?v=2` no fim do link.

## Fontes do conteúdo

Os guias consultados estão listados no fim de cada página (Steam Community, IGN, GameFAQs, GamesRadar, TrueAchievements, GameFront). As dicas foram resumidas com palavras próprias. LEGO The Hobbit é marca de seus respectivos donos; este é um guia comunitário não oficial.
