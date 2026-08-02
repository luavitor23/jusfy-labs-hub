# Banco de logos do Studio

Cada regional é um arquivo próprio nesta pasta, já no formato de composto aprovado (marca regional + `+` + Jusfy).
A partir de 27/07/2026 o padrão é **PNG** — o posicionamento fica mais previsível do que com os SVGs antigos.

## Como cadastrar uma regional nova

1. Salve o arquivo como `banco-logos/<id>.png`, tudo em minúsculas (ex.: `caapr.png`). O `<id>` precisa ser
   exatamente o `id` da entrada no `catalog.json` — o servidor casa o arquivo pelo id, então um nome fora do
   padrão deixa a logo sem imagem.
2. Adicione a entrada no `catalog.json` com `id`, `name`, `region` (`OAB/UF`), `stateName` (nome do estado por
   extenso) e `source` apontando para o arquivo.
3. Recarregue o Studio e confira a peça antes de aprovar.

## Comportamento

- A regional selecionada define a logo e substitui automaticamente `OAB/UF`, a sigla do estado e o nome do
  estado por extenso (`stateName`) nas copies do Notion.
- As caixas de seleção geram versões em massa para várias regionais; com copies marcadas, o lote é a
  combinação de copies × logos.
- Como o arquivo já é o composto fechado, o Studio desenha a imagem inteira e não remonta o espaçamento entre
  as marcas. O modo "Somente Jusfy" usa `jusfy.png`.
- SVG continua aceito (`<id>.svg`) como fallback; se existirem os dois arquivos, o PNG tem prioridade.
- Novas marcas devem ser adicionadas ao `catalog.json` somente após revisão visual.
