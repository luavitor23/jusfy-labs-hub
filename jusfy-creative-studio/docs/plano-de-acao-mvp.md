# Construtor de Criativos — Plano de ação do MVP

> Atualização em 16/07/2026: o próximo ciclo do MVP passou a usar o Studio de Criativos local como ambiente operacional. Canva permanece como referência histórica; Figma e Photoshop fornecem os layouts. Consulte `docs/editor-local-mvp.md` para o escopo implementado e as regras de exportação SVG.

## Objetivo da documentação

Centralizar as decisões, regras, aprendizados e próximos passos da criação do Construtor de Criativos. Esta documentação deverá ser transferida para uma página principal no Notion quando a integração estiver disponível.

## Visão do produto

Construir um sistema de criação de peças baseado em modelos previamente aprovados, kits de marca, copies, imagens e ícones.

A criação será assistida por IA, mas seguirá regras definidas nos templates. Toda geração começará por uma solicitação. A pessoa poderá partir de um briefing ou fornecer uma peça que já funciona como referência para pedir novas versões.

## Escopo do MVP

### Incluído

- Criação por briefing.
- Criação a partir de uma referência existente.
- Referências por link do Figma ou arquivo visual.
- Escolha de um layout aprovado.
- Troca de logo, texto, imagem ou ícone.
- Geração de múltiplas opções sob solicitação.
- Adaptação para os formatos 1:1 e 9:16.
- Revisão humana antes da aprovação e exportação.
- Registro do briefing, versões e decisões.

### Fora do MVP

- Geração automática por planilha.
- Processamento de campanhas sem solicitação inicial.
- Design System completo.
- Automação de todos os layouts existentes.

## Formas de solicitar uma criação

### 1. Criar por briefing

O briefing deverá informar:

- objetivo;
- assunto;
- persona;
- abrangência: Brasil ou OAB;
- região, quando a abrangência for OAB;
- marca;
- formatos desejados;
- quantidade de opções;
- orientações adicionais.

### 2. Criar a partir de uma referência

O usuário deverá fornecer:

- link do Figma, imagem ou criativo aprovado;
- elementos que devem permanecer;
- elementos que devem ser substituídos;
- formatos necessários;
- quantidade de versões desejadas.

Arquivos editáveis do Figma são a referência preferencial. Quando a entrada for somente uma imagem plana, como PNG ou JPG, o sistema deverá interpretar a peça e recriá-la utilizando o template mais próximo disponível.

## Estrutura da base

### 1. Repositório de layouts — Figma Design

Cada template deverá conter:

- nome;
- categoria;
- formatos disponíveis;
- campos editáveis;
- elementos protegidos;
- limites de caracteres;
- logos permitidos;
- regras de enquadramento;
- versões Brasil e OAB, quando aplicável.

### 2. Repositório de copies

Cada copy deverá conter:

- título;
- texto complementar;
- CTA;
- objetivo;
- assunto;
- persona;
- abrangência: Brasil ou OAB;
- região, quando a abrangência for OAB;
- status: rascunho, aprovado ou arquivado.

### 3. Repositório de imagens e ícones

Cada item deverá conter:

- arquivo original;
- tipo: imagem ou ícone;
- categoria;
- tema;
- formato;
- ponto focal, quando aplicável;
- origem;
- status de aprovação;
- marcas e campanhas permitidas.

O prompt utilizado para gerar uma imagem não fará parte do cadastro do MVP.

### 4. Base visual inicial

Não será necessário criar um Design System completo no início. A base visual do MVP terá apenas:

- cores utilizadas;
- fontes e pesos;
- tamanhos de texto;
- espaçamentos principais;
- regras básicas de aplicação dos logos;
- componentes necessários para o template piloto;
- adaptações para 1:1 e 9:16.

Essa base poderá evoluir gradualmente para um Design System conforme novos templates forem incorporados.

### 5. Kits de marca

Cada kit deverá conter:

- logos e variações;
- paleta de cores;
- fontes;
- nome da marca ou regional;
- aplicações permitidas;
- fundos proibidos;
- margens mínimas.

### 6. Campanhas e histórico

Cada solicitação deverá registrar:

- briefing ou referência;
- materiais selecionados;
- versões produzidas;
- alterações solicitadas;
- peças aprovadas;
- arquivos exportados.

## Primeiro piloto

- Família de layouts: Breaking News + Headlines.
- Regional inicial: CAASP.
- Formatos: 1:1 e 9:16.
- Dois kits de marca.
- Aproximadamente dez copies.
- Aproximadamente dez imagens ou ícones.
- Troca de logo, texto e imagem.
- Geração de múltiplas opções sob solicitação.
- Revisão humana antes da exportação.

## Fluxo operacional do MVP

1. A pessoa envia um briefing ou uma referência.
2. A IA interpreta a solicitação.
3. A IA consulta layouts, copies, imagens, ícones e kits de marca aprovados.
4. O sistema monta uma ou mais opções dentro das regras do template.
5. A pessoa revisa as opções.
6. As correções solicitadas são aplicadas.
7. A versão aprovada é exportada.
8. A solicitação e o resultado ficam registrados no histórico.

## Próximos passos

1. Preparar o piloto no espaço gratuito do Figma.
2. Organizar CAASP 1:1 e 9:16 como templates configuráveis.
3. Mapear os campos editáveis e protegidos.
4. Definir limites e regras para cada campo.
5. Reunir dois kits de marca.
6. Organizar as primeiras copies, imagens e ícones.
7. Testar o fluxo por briefing.
8. Testar o fluxo a partir de uma peça existente.
9. Documentar dificuldades, decisões e limitações.
10. Decidir entre Figma Buzz e uma aplicação própria após o piloto.

## Estrutura sugerida para o Notion

Página principal: **Construtor de Criativos**

- Visão geral e decisões
- Escopo do MVP
- Repositório de layouts
- Repositório de copies
- Repositório de imagens e ícones
- Base visual inicial
- Kits de marca
- Piloto Breaking News + Headlines
- Testes e aprendizados
- Próximos passos

## Decisões registradas

- O MVP será iniciado no espaço gratuito do Figma.
- Toda geração começará por uma solicitação.
- O MVP não terá geração automática por planilha.
- A entrada poderá ser um briefing ou uma referência existente.
- O campo público foi substituído por persona.
- A abrangência será Brasil ou OAB; na opção OAB, a região deverá ser informada.
- Restrições jurídicas não farão parte do cadastro de copies no MVP.
- O repositório visual terá imagens e ícones, sem armazenar prompts.
- Um Design System completo não é pré-requisito para o piloto.
