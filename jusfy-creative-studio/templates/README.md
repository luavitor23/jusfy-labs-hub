# Catálogo de modelos do Studio

Cada modelo ativo ocupa uma pasta `templates/modelo-N/` e é descoberto automaticamente pelo servidor. Nenhum arquivo em `js/` precisa ser alterado para cadastrar outro modelo.

O padrão que o time de Design deve aplicar às camadas do Figma está em [`docs/guia-figma-camadas-svg.md`](../docs/guia-figma-camadas-svg.md).

## Estrutura mínima

```text
templates/
  modelo-4/
    manifest.json
    feed.svg
    stories.svg
```

O `manifest.json` define identificação, descrição, copies padrão, campos habilitados e o mapa independente de `square` e `story`. Use um modelo existente como ponto de partida, troque o `id`, `order`, `label`, textos e coordenadas, e preserve os nomes `feed.svg` e `stories.svg`.

Regras obrigatórias:

- nunca reutilizar um número ou `id` existente;
- cadastrar sempre 1:1 e 9:16 juntos;
- manter apenas os campos autorizados em `enabledFields`;
- marcar a nota comercial como `runtime`, `embedded` ou `none` em `commercialNoteMode`;
- quando a nota estiver embutida, usar exatamente `*Válido no primeiro mês para assinantes no plano degustação.`;
- executar `python scripts/validate_templates.py` antes de abrir o Studio;
- revisar visualmente os dois formatos antes de aprovar.

Arquivos adicionais do modelo ficam dentro da própria pasta, por exemplo `components/preco.svg`. Caminhos informados no manifesto não podem sair de `templates/`.

## Elementos decorativos livres (`freeElements`)

Selos, estrelinhas e outros elementos decorativos fixos do SVG podem virar arrastáveis/redimensionáveis no Studio sem precisar de um banco de imagens: basta declarar `"freeElements"` no formato, com a região exata (em pixels do próprio SVG) que deve virar um elemento independente:

```json
"freeElements": {
  "badge1": {"label": "Selo 1", "bounds": [171, 501, 493, 120]},
  "star1": {"label": "Estrela 1", "bounds": [896.7, 762.7, 42.5, 43.6]}
}
```

O Studio recorta essa região da arte original na hora de carregar o modelo e a redesenha como uma camada arrastável, com as mesmas alças de canto do bloco comercial e do composto de logos.

Regras:

- `bounds` é `[x, y, largura, altura]` nas mesmas coordenadas do SVG; some 2–5px de margem para não deixar um risco fino do recorte antigo aparecendo depois de mover o elemento.
- Toda região marcada como `freeElement` precisa também de uma entrada correspondente em `patches` (mesmas coordenadas, cor de fundo do modelo) — sem isso o elemento aparece duplicado (uma cópia fixa de fundo + a cópia arrastável por cima).
- Só usar em regiões sobre **fundo liso**. Um elemento movido para longe do lugar original deixa um retângulo da cor do patch onde estava; sobre um gradiente, foto ou círculo decorativo isso aparece como um remendo visível. Elementos sobre fundo não-liso devem continuar fixos (sem `freeElements`).
- A chave (`badge1`, `star1`, etc.) é livre, mas precisa ser única dentro do formato.
