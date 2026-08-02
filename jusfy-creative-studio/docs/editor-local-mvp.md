# Studio de Criativos local — MVP

## Refresh de manutenção — 17/07/2026

- inicializador agora reconhece quando o Studio já está ativo;
- o servidor local usa `no-cache` e os assets possuem versão para evitar arquivos antigos após o refresh;
- fonte Poppins passou a carregar dos arquivos locais do projeto;
- SVG achatado sem mapeamento não exibe mais campos que aparentavam funcionar;
- exportação SVG libera corretamente o arquivo temporário e preserva o separador do co-branding;
- áreas dos logos foram ampliadas para remover resíduos do arquivo vetorizado;
- selo protegido atualizado para `R$ 19,90` com a observação obrigatória;
- cartões comerciais atualizados a partir dos componentes oficiais: 415 × 242 para preço e 411 × 242 para desconto, com cantos arredondados, fundo translúcido, ícones preservados e asterisco junto ao preço;
- o desconto protegido de 30% permanece inalterado.

## Por que esta direção existe

Os criativos do time de design nascem no Figma e no Photoshop. Ao transportar uma arte achatada para o Canva, a estrutura deixa de ser confiavelmente editável. O Studio local remove essa dependência e trabalha diretamente com os arquivos exportados pelo design.

## O que já funciona

- templates CAASP 1:1 (1080 × 1080) e 9:16 (1080 × 1920);
- seleção por família de design, mantendo mapas, copies e posições independentes;
- família **Manual** adicionada nos formatos 1:1 e 9:16 sem substituir **Condições especiais**;
- importadores separados para SVG 1:1 e SVG 9:16;
- aplicação automática do mapa editável do formato sobre SVGs vetorizados exportados do Figma;
- edição de categoria, headline, texto de apoio e CTA;
- troca independente do logo regional e do logo Jusfy;
- seleção e reposicionamento de textos e logos diretamente na prévia;
- ajuste do tamanho da fonte do elemento de texto selecionado;
- exclusão reversível e restauração dos elementos variáveis;
- posições e tamanhos independentes para os formatos 1:1 e 9:16;
- reposicionamento e redimensionamento do bloco comercial como conjunto protegido;
- salvamento de mestres aprovados com SVG, prévia PNG e mapa do layout;
- banco local de logos regionais com seleção por OAB;
- seleção múltipla de regionais e geração de um lote para todas as marcas marcadas;
- combinação em massa de copies × regionais, mantendo o logo correto em cada prévia e exportação;
- remoção automática do fundo branco ou quase branco dos recortes vindos da prancha de logos;
- catálogo de copies sincronizadas do Notion, com filtro por status;
- geração em massa das copies selecionadas para uma ou várias regionais;
- substituição automática de `OAB/UF` pela regional selecionada;
- preservação do selo, desconto e estrutura visual;
- importação de outros SVGs;
- detecção automática de elementos `<text>` e `<image>`;
- suporte a SVG achatado por mapa de campos do template;
- criação de variações em massa por linhas separadas por ponto e vírgula;
- revisão individual das versões;
- exportação em PNG e SVG;
- rascunho salvo no navegador local.

## Como iniciar

1. Dê dois cliques em `INICIAR-EDITOR.cmd`.
2. Mantenha a janela do PowerShell aberta durante o uso.
3. O navegador abrirá `http://127.0.0.1:8765/`.
4. Para encerrar, volte à janela do PowerShell e pressione `Ctrl+C`.

Nenhum arquivo é enviado para a internet pelo editor. A fonte Poppins é carregada dos arquivos locais do projeto.

## Como importar arquivos do Figma

1. Exporte um SVG separado para cada formato.
2. Use **Importar 1:1** para arquivos quadrados e **Importar 9:16** para arquivos verticais.
3. Se o SVG vier com a copy em curvas, o Studio usa o mapa do formato para reconstruir os campos variáveis sobre a base importada.
4. O Studio confirma o nome carregado e tenta reconhecer a regional pelo nome do arquivo, como `CAAPI` → `OAB/PI`.
5. SVGs importados abrem como **Textos protegidos**: o conteúdo muda pelos campos do Studio, enquanto posição, tipografia e estrutura permanecem controladas.
6. Ajuste os campos autorizados e revise cada formato separadamente.

Arquivos da mesma família visual dos mestres atuais podem ser importados diretamente, sem cadastro prévio de cada regional. Uma família com posições, proporções ou estrutura diferentes precisa de um novo mapa de campos uma única vez. No Figma, prefira desativar **Outline text** na exportação SVG para preservar textos como `<text>`; mesmo assim, o mapa continua sendo o fallback para arquivos vetorizados.

## Como adicionar uma nova família de design

### Padrão de nomenclatura

- Todo layout deve aparecer no Studio como `Modelo N`, usando o próximo número disponível: `Modelo 1`, `Modelo 2`, `Modelo 3` e assim por diante.
- A descrição abaixo do nome registra o tema do layout sem substituir sua identificação numérica.
- Os SVGs preservados em `imports` usam `modelo-N-feed.svg` e `modelo-N-stories.svg`.
- Um número já utilizado não deve ser reaproveitado ou renumerado, para não quebrar mestres, rascunhos e copies vinculadas.

No `Modelo 3` (e nos Modelos 2 e 5), o quadrante comercial tem uma região `commercial` própria com patch de erase sobre a arte original; o preço e o desconto exibidos vêm do banco de ofertas (`banco-ofertas/`), não de texto fixo no SVG. Os componentes de origem legados ficam preservados em `imports/modelo-3-preco.svg` e `imports/modelo-3-desconto.svg`.

A nota legal fixa (`*Válido no primeiro mês para assinantes no plano degustação.`) foi removida do Studio em 22/07/2026 e não é mais desenhada em nenhum modelo, nem no canvas nem no export. Se uma promoção exigir texto legal, ele precisa estar dentro do próprio PNG da oferta escolhida no banco de ofertas.

1. Criar a pasta `templates/modelo-N/` com o próximo número disponível.
2. Salvar os SVGs como `feed.svg` e `stories.svg` dentro dessa pasta.
3. Copiar um `manifest.json` de um modelo semelhante e ajustar identificação, textos padrão, campos habilitados, áreas cobertas e posições editáveis dos dois formatos.
4. Executar `python scripts/validate_templates.py`. O servidor descobre a nova pasta automaticamente; não é necessário alterar nenhum arquivo em `js/` nem `studio-server.py`.
5. Abrir o Studio e validar troca de logos, copy e enquadramento separadamente nos dois formatos.

O formato completo e as regras do manifesto estão em `templates/README.md`. Os modelos atuais foram migrados para essa estrutura; a pasta `imports` permanece somente como histórico dos arquivos recebidos.

Cada família mantém seu próprio rascunho de texto e mapa de layout; alternar entre famílias não deve transportar a copy ou as posições de uma para outra.

Os campos de texto podem informar `referenceLength` e `lengthScaling`. Assim, o Studio reduz a tipografia automaticamente quando uma nova copy é maior que a copy de referência, respeitando o número máximo de linhas e mantendo os controles manuais de tamanho.

Para vincular uma copy a modelos específicos, o registro da biblioteca pode receber `families`, por exemplo `"families": ["manual"]`. Registros antigos sem esse campo continuam disponíveis em todos os modelos.

O modo de edição livre das camadas `<text>` permanece preservado no HTML e no código para uso futuro, mas está oculto e desativado. Nesta fase, as alterações de texto usam os campos e limites do mapa do Studio.

## Como salvar um mestre aprovado

1. Ajuste e revise o formato atual na prévia.
2. Informe um nome para o mestre.
3. Marque a confirmação de revisão humana.
4. Clique em **Salvar como mestre**.
5. Repita o processo separadamente para 1:1 e 9:16.

O Studio cria uma nova pasta em `mestres-aprovados` sem sobrescrever versões anteriores.

## Banco de logos e copies do Notion

1. Clique em uma regional no **Banco de logos** para usá-la na prévia individual.
2. Marque uma ou várias caixas de seleção e use **Gerar por regionais** para replicar a copy atual em todas elas.
3. Em **Copies do Notion**, mantenha somente aprovadas ou ative **Incluir em revisão** conscientemente.
4. Marque as copies desejadas e clique em **Gerar selecionadas**. Se houver várias regionais marcadas, o Studio cria a combinação `copies × regionais`.
5. Revise cada item da lista antes de exportar o lote; cada item carrega e exporta seu próprio logo regional.

O botão **Atualizar do Notion** tenta a sincronização ao vivo quando a variável segura `NOTION_TOKEN` está configurada no processo do servidor. Sem essa integração, o Studio usa o espelho local mais recente, criado pelo fluxo assistido do Codex. Nenhuma credencial é enviada ao navegador ou salva nos arquivos do projeto.

## Formato do lote

Use uma linha por versão:

```text
nome;headline;apoio;cta
OAB-PE;Headline de Pernambuco;Texto de apoio;CTA regional
OAB-RJ;Headline do Rio;Outro texto de apoio;Outro CTA
```

O botão **Usar exemplo** preenche duas versões de demonstração.

## Recomendação de exportação do design

Para que um novo SVG seja realmente editável:

- manter copy como texto, sem converter em curvas;
- preservar imagens em elementos `<image>`;
- não achatar a peça inteira em uma imagem dentro do SVG;
- usar nomes de camada estáveis para categoria, headline, apoio, CTA e logos;
- anexar ou disponibilizar as fontes usadas;
- exportar cada formato separadamente;
- validar o `viewBox` e as dimensões finais.

Arquivos com texto convertido em curvas ainda podem ser usados, mas cada família de layout precisará de um mapa manual de áreas editáveis.

## Limitações do primeiro ciclo

- PSD não é interpretado diretamente; deve ser exportado como SVG preservando camadas compatíveis.
- SVG achatado não recupera semanticamente o texto original.
- O mapa atual reconhece os formatos 1:1 e 9:16 desta família de Condições Especiais; layouts visualmente diferentes precisam de um mapa próprio.
- O parser de lote é simples e não aceita ponto e vírgula dentro dos próprios campos.
- O navegador pode pedir permissão para múltiplos downloads ao exportar um lote.
- Cada nova família achatada precisa de configuração própria de posições e limites.
