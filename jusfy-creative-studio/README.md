# Studio de Criativos — Jusfy

Editor local para gerar variações de criativos (feed 1:1 e stories 9:16) a partir de templates SVG, com banco de logos regionais (OAB), banco de ofertas, geração em massa e export em `.zip`.

## Requisitos

- Python 3.9+ (só biblioteca padrão — nenhum `pip install` necessário).
- Um navegador para abrir o editor.

## Como rodar

**Windows:** dê duplo clique em `INICIAR-EDITOR.cmd` (ou rode `iniciar-editor.ps1` no PowerShell). Ele sobe o servidor e abre `http://127.0.0.1:8765/` automaticamente.

**Mac/Linux ou execução manual:**

```bash
python3 studio-server.py
```

Depois acesse `http://127.0.0.1:8765/` no navegador. `Ctrl+C` no terminal encerra o servidor.

## Sincronização de copies (opcional)

O banco de copies já vem com um snapshot em `dados/copies-notion.json`. Para puxar copies ao vivo do Notion, defina a variável de ambiente `NOTION_TOKEN` antes de iniciar o servidor:

```bash
export NOTION_TOKEN=seu_token_de_integracao_notion
python3 studio-server.py
```

Sem o token, o Studio usa normalmente o snapshot local.

## Estrutura do projeto

| Pasta/arquivo | Conteúdo |
|---|---|
| `studio-server.py`, `template_catalog.py` | backend (servidor HTTP local + descoberta/validação de templates) |
| `js/` | frontend (ES modules, ver `AGENTS.md` para o mapa de cada arquivo) |
| `templates/modelo-N/` | cada modelo com `feed.svg`, `stories.svg`, `manifest.json` |
| `banco-logos/` | composições de logo Jusfy + regionais (OAB) |
| `banco-ofertas/` | designs prontos do bloco de preço/desconto |
| `dados/copies-notion.json` | snapshot das copies |
| `assets/` | fontes (Poppins) e imagens de fundo |
| `scripts/validate_templates.py` | valida os manifestos dos templates |

Detalhes de arquitetura, regras de marca e histórico de decisões estão em [`AGENTS.md`](./AGENTS.md).

## Validação de templates

Antes de aprovar um lote, rode:

```bash
python3 scripts/validate_templates.py
```

## O que não está neste repositório

As pastas `tmp/`, `output/`, `previews/`, `imports/` e `mestres-aprovados/` são geradas localmente pelo próprio Studio (rascunhos, exports e mestres salvos) e ficam de fora do controle de versão — não são necessárias para rodar o editor.
