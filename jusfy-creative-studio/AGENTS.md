# Construtor de Criativos — contexto obrigatório

Estas instruções se aplicam a todo o projeto. Ao iniciar qualquer tarefa nesta pasta, leia este arquivo antes de agir.

## Fonte de verdade vigente — Craft (21/07/2026)

O **Craft** é a central de conhecimento e contexto do projeto: regras, decisões, solicitações, copies e histórico vivem lá, não neste arquivo.

Local obrigatório no Craft:

- `🗂️ Projetos → Jusfy → 🎨 Construtor de Criativos`
- Documento inicial: `🏠 Central do projeto`

Antes de executar uma nova solicitação:

1. Ler `🏠 Central do projeto` no Craft.
2. Ler o plano de ação, as regras de marca e a operação do Studio no mesmo local.
3. Consultar as coleções `Solicitações de criativos` e `Copies — Condições especiais`.
4. Registrar no Craft qualquer nova decisão, aprovação, alteração estrutural ou próximo passo — só quando o usuário pedir explicitamente para salvar (não a cada tarefa concluída).
5. Usar o Notion somente para rastrear conteúdo histórico ainda não migrado.

Código, SVGs, templates e assets operacionais do Studio ficam na pasta local do projeto. Arquivos finais para baixar ou compartilhar vão para o Google Drive.

## Direção vigente — editor local

O ambiente operacional é o **Studio de Criativos local** (`INICIAR-EDITOR.cmd`, `http://127.0.0.1:8765/`). Figma e Photoshop são as fontes dos layouts (preferencialmente SVG); Canva e Notion são referência histórica — só operá-los quando uma solicitação pedir explicitamente uma entrega neles (ver `docs/` para o fluxo legado).

Para tarefas do editor local:

1. Ler o Craft e confirmar a solicitação vigente.
2. Usar os SVGs do time de design como entrada, preservando textos como `<text>` e imagens como `<image>`.
3. Preservar elementos protegidos e permitir apenas os campos mapeados no manifesto do modelo.
4. Revisar 1:1 e 9:16 separadamente.
5. Exportar e pedir revisão humana antes de considerar o lote aprovado.

## Arquitetura do código

Backend (Python, um arquivo cada):

- `studio-server.py` — servidor HTTP local e rotas `/api/*`.
- `template_catalog.py` — descoberta e validação de `templates/modelo-*/manifest.json`.

Frontend (ES modules em `js/`, carregados por `index.html` via `<script type="module" src="js/main.js">`):

| Arquivo | Responsabilidade |
|---|---|
| `state.js` | estado compartilhado, refs de DOM, constantes |
| `catalog.js` | carrega `/api/templates`, layout por família, campos de copy permitidos |
| `svg-io.js` | parsing de SVG, arquivos, imagens, fontes — sem estado |
| `draw.js` | primitivas de desenho no canvas (texto ajustado, bloco comercial, logos) |
| `render.js` | orquestra o `render()`, persistência local (`saveLocal`/`restoreLocal`), export SVG/PNG |
| `interaction.js` | réguas, guias, seleção de elemento e drag (posição/largura/escala) |
| `assets-banks.js` | banco de logos, banco de ofertas, regionalização (OAB/UF) |
| `template-loader.js` | troca de modelo/formato, import de SVG externo, diagnóstico de saúde do arquivo |
| `copies.js` | biblioteca de copies sincronizadas do Notion |
| `batch.js` | geração em massa, fila de revisão, export ZIP |
| `masters.js` | salvar/listar/reabrir mestres aprovados |
| `errors.js` | handler de erro compartilhado (`showError`) |
| `main.js` | bootstrap — liga todos os eventos de UI e inicia `startStudio()` |

Para adicionar um modelo novo, **nenhum arquivo de `js/` precisa ser alterado**: basta criar `templates/modelo-N/` com `feed.svg`, `stories.svg` e `manifest.json` (ver `templates/README.md`) e rodar `python scripts/validate_templates.py`. Para mexer numa funcionalidade específica (ex.: drag, banco de ofertas, export em lote), abra só o módulo correspondente da tabela acima — não é preciso ler o projeto inteiro.

`zip-writer.js` é um script clássico (não-módulo) que expõe `window.buildZip`, carregado antes de `main.js`.

## Regras de conteúdo e visuais atuais

- Preço do selo padrão: `R$ 19,90` no primeiro mês (agora escolhido no banco de ofertas, não fixo).
- Nota legal obrigatória **removida** a pedido do usuário (22/07/2026) — não é mais desenhada em nenhum modelo.
- Co-branding: composto único Jusfy + regional, espaçamento fixo borda-a-borda; opção "Jusfy somente" quando `cobranding: false` no manifesto.
- Nenhuma peça ou lote é considerada aprovada sem revisão humana.

## Legado — Notion e Canva

Regras completas do fluxo antigo (pastas do Canva, mestres oficiais, links do Notion) ficam documentadas no Craft, seção `Histórico, decisões e referências`, e não são repetidas aqui. Só seguir esse fluxo quando uma solicitação pedir explicitamente uma entrega no Canva.

## Continuidade e documentação

- Uma conversa pode cuidar de uma entrega ou lote completo; uma nova campanha, modelo ou fase pode começar em outra conversa.
- Ao final de todo lote aprovado, atualizar o Craft quando solicitado e, se a arquitetura ou regras estruturais mudarem, atualizar este `AGENTS.md`.
- Em caso de divergência, prevalece o conteúdo mais recente do Craft confirmado no Studio local.
- Preservar os arquivos existentes e não sobrescrever alterações do usuário sem necessidade.
