# Guia para o time de Design — preparação de SVGs para o Studio

Este é o padrão de configuração das camadas no Figma para que um novo layout seja reconhecido pelo Studio de Criativos.

## Regra principal

- Use `studio-*` somente nos elementos que poderão ser substituídos no Studio.
- Use `protected-*` nos elementos que devem permanecer iguais ao layout aprovado.
- Aplique o nome na camada correta: texto em uma camada de texto; logo no grupo completo da logo.
- Cada nome deve aparecer apenas uma vez em cada arquivo SVG.
- Se um campo não existir no layout, não crie um marcador vazio e não aplique seu nome em um retângulo.

## Nomes das camadas editáveis

| Conteúdo | Nome exato no Figma | Tipo de camada | Obrigatório? |
|---|---|---|---|
| Categoria ou chapéu | `studio-category` | Texto | Somente se existir |
| Headline principal | `studio-headline` | Texto | Sim |
| Texto de apoio | `studio-support` | Texto | Somente se existir |
| CTA | `studio-cta` | Texto | Somente se existir |
| Logo regional/OAB | `studio-logo-regional` | Grupo contendo a logo completa | Sim em modelos OAB |
| Logo Jusfy | `studio-logo-jusfy` | Grupo contendo a logo completa | Sim |

O nome `studio-support`, por exemplo, deve ficar diretamente na camada que contém o texto de apoio. Não deve ser aplicado no fundo, no retângulo ou no frame que envolve o texto.

## Nomes sugeridos para elementos protegidos

Os nomes protegidos podem ser descritivos, mas devem começar com `protected-` e ser únicos:

| Conteúdo | Exemplo de nome |
|---|---|
| Fundo | `protected-background` |
| Ilustração ou fotografia | `protected-image` |
| Elementos decorativos | `protected-decoration-stars` |
| Componente comercial completo | `protected-commercial` |
| Preço | `protected-price` |
| Desconto | `protected-discount` |
| Observação legal | `protected-commercial-note` |

Para criativos OAB, preço, oferta de 30% e observação legal são protegidos e não devem receber nomes `studio-*`.

## Exemplo da árvore de camadas

```text
modelo-5-feed
├── protected-background
├── protected-decoration-stars
├── protected-image
├── studio-category              [TEXTO — opcional]
├── studio-headline              [TEXTO]
├── studio-support               [TEXTO — opcional]
├── studio-cta                   [TEXTO — opcional]
├── studio-logo-regional         [GRUPO DA LOGO]
├── studio-logo-jusfy            [GRUPO DA LOGO]
└── protected-commercial         [GRUPO]
    ├── protected-price
    ├── protected-discount
    └── protected-commercial-note
```

Repita os mesmos nomes semânticos no arquivo de stories. Os dois formatos são arquivos independentes e serão revisados separadamente.

## Regras para textos

- Mantenha o texto como camada de texto do Figma.
- Não use **Flatten** e não converta o texto em curvas/outlines.
- Mantenha a caixa de texto com a largura prevista para as variações.
- Use quebras de linha dentro da própria camada quando forem necessárias.
- Informe a fonte usada e preserve o peso tipográfico.
- Não coloque dois campos editáveis diferentes dentro da mesma camada de texto.

## Regras para logos e imagens

- Agrupe todos os elementos de cada logo e nomeie o grupo completo.
- Não junte a logo regional e a logo Jusfy no mesmo grupo ou imagem.
- Não incorpore fundo branco ou quase branco à logo.
- Não distorça, recolora ou converta as logos em uma única imagem raster.
- Fotografias e ilustrações fixas podem permanecer como imagem raster, desde que estejam em uma camada `protected-*`.

## Regras comerciais dos modelos OAB

- Preço vigente: `R$ 19,90*` no primeiro mês.
- Oferta fixa: `30% OFF`.
- Observação obrigatória, exatamente: `*Válido no primeiro mês para assinantes no plano degustação.`
- Preço, oferta e observação devem ficar protegidos.

## Exportação do Figma

Crie um SVG separado para cada formato:

- `modelo-N-feed.svg` para 1:1;
- `modelo-N-stories.svg` para 9:16.

Na exportação SVG:

- ative **Include id attribute**;
- mantenha **Outline text** desativado;
- mantenha **Simplify stroke** desativado;
- mantenha **Ignore overlapping layers** desativado.

## Checklist antes de enviar

- [ ] Feed e stories foram exportados separadamente.
- [ ] A headline está nomeada como `studio-headline` na própria camada de texto.
- [ ] Apoio, CTA e categoria usam seus nomes somente quando existem.
- [ ] As duas logos estão em grupos separados.
- [ ] Não existem nomes `studio-*` duplicados.
- [ ] Nenhum nome de texto editável foi aplicado a um retângulo.
- [ ] Os textos não foram convertidos em curvas.
- [ ] Preço, desconto, observação e decoração estão protegidos.
- [ ] O SVG foi exportado com **Include id attribute** ativado.

Depois do envio, o arquivo ainda passa pela validação automática do Studio e pela revisão visual independente de 1:1 e 9:16.
