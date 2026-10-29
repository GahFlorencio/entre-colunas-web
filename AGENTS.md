# Diretrizes para alterações no app web

Estas regras orientam novas telas e melhorias nas telas existentes. Preserve o padrão visual do app e as regras financeiras da API.

## Mobile first

- Projete primeiro para 320–390 px de largura. Depois adapte para tablet e desktop.
- Use containers fluidos, `min-width: 0` e colunas com `minmax(0, 1fr)`. Evite larguras fixas que provoquem rolagem horizontal.
- Comprima espaçamento e conteúdo secundário antes de reduzir fontes ou áreas de toque.
- Mantenha controles tocáveis com pelo menos 44 × 44 px. Ícones podem ser menores dentro desse alvo.
- Não dependa de hover. Todas as ações devem funcionar por toque e teclado.
- Confira textos longos, nomes, categorias, IDs extensos e valores grandes. Quebre títulos quando necessário; use reticências apenas em informações secundárias que possam ser consultadas por outro meio.
- Não considere a versão mobile aprovada apenas porque o desktop foi redimensionado. Confira também o contexto mobile, a altura disponível e o comportamento do teclado.

## Hierarquia e telas condensadas

- Use um cabeçalho curto: título, contexto indispensável e ações principais. Evite sobrancelhas, frases decorativas e parágrafos introdutórios.
- Prefira rótulos diretos, como “Caixa”, “PDF”, “Novo”, “Extrato” e “Membros”. Botões só com ícone precisam de nome acessível.
- Mantenha valores e ações essenciais visíveis. Mostre explicações e configurações secundárias sob demanda.
- Use a tela Geral e a tela de Período como referências de densidade, sem copiar seus layouts mecanicamente.
- Quando houver três cards, considere o principal ocupando a linha e os outros dois lado a lado no celular; no desktop, três colunas. Preserve a leitura de valores grandes.
- Evite vários cards repetindo contexto, descrição ou total. Diferencie informação principal de metadados.
- Em listas, priorize descrição, valor e situação. Use metadados curtos e alinhamento consistente.
- Não duplique listas com a mesma finalidade. Exemplo: em período fechado, exiba o demonstrativo por membro como visão principal dos membros.
- Use abas quando houver conteúdos distintos que disputam espaço. Na tela de Período: “Visão Geral”, “Extrato” e “Membros”. A exportação deve incluir o relatório completo, independentemente da aba aberta.
- Detalhes essenciais do período ficam no topo, acima dos cards; não os esconda em accordion.

## Padrão aprovado de extrato

O extrato do detalhe de membro foi aprovado como referência visual para futuras telas de movimentações financeiras. Reutilize `src/components/MovementList.vue`, extraído de `src/views/StatementView.vue` (versão `embedded` e classes `ledger-*`), e consulte os cenários de `tests/e2e/member-detail.spec.ts`. A tela `src/views/MemberPeriodView.vue` também aplica esse componente. Replique a linguagem visual, adaptando o conteúdo à finalidade de cada tela.

- Use uma lista leve, com divisórias sutis entre movimentos, sem um card grande para cada lançamento. Separe o resumo financeiro da lista; não repita o saldo no cabeçalho do extrato.
- Agrupe movimentos consecutivos pela data exibida, com um cabeçalho de data pequeno e discreto. Preserve a ordenação e a paginação oficiais da API; não reordene apenas a página atual para simular uma ordenação global. Informe corretamente o significado da data disponível.
- Cada movimento deve priorizar descrição e valor. A descrição usa peso semibold, cerca de 14 px e quebra de linha completa. Tipo de operação e categoria ficam abaixo, em texto secundário de cerca de 12 px; omita separadores quando não houver categoria.
- À esquerda, use um ícone de direção em um círculo discreto de aproximadamente 36 px, com ícone de 18 px: seta para baixo e à esquerda para crédito, para cima e à direita para débito. Reutilize os ícones e tokens existentes. Ícones acompanhados por texto equivalente são decorativos.
- Mostre o valor com peso semibold e algarismos tabulares, incluindo sinal explícito: `+` para crédito e `−` para débito. Exiba também “Crédito” ou “Débito” em texto secundário. Crédito pode usar a cor semântica de sucesso; débito pode usar a cor principal do texto. Não dependa somente da cor para comunicar a direção.
- No celular, organize ícone à esquerda e conteúdo em uma coluna flexível à direita. O valor fica abaixo dos metadados, alinhado ao início da descrição, com a direção ao lado quando couber. Permita quebra dos metadados antes de comprimir a informação principal. Nomes, descrições e valores grandes precisam continuar legíveis em 320 px.
- Em larguras maiores, use uma linha com ícone, descrição e metadados flexíveis, valor alinhado à direita e chevron discreto indicando acesso ao detalhe. Como referência, a implementação passa a esse arranjo em 600 px. O chevron pode ser omitido no celular.
- Quando houver detalhe navegável, a linha inteira deve ser um link semântico, operável por toque e teclado, com foco visível e alvo de pelo menos 44 px de altura. O ícone circular não é um botão separado. Não use chevron ou aparência clicável em movimentos sem destino.
- Mantenha o cabeçalho da lista curto, por exemplo “Movimentações”, com o botão de funil à direita e a contagem de filtros aplicados. Siga as regras de edição, aplicação, cancelamento e restauração de foco dos filtros deste documento.
- Coloque contagem e paginação ao final da lista. Distinga carregamento, erro com nova tentativa e ausência de movimentos; não apresente falhas como lista vazia ou saldo zero.
- O resumo financeiro permanece fora das abas quando for contexto comum às visões. No detalhe do membro, mostre “Saldo atual” oficial e “A pagar” referente à dívida já lançada, identificando essa abrangência. Saldo positivo é crédito; saldo negativo é dívida. Não trate créditos como dívida nem inclua cobranças futuras sem fonte oficial específica.
- Antes de replicar, confira visualmente os dois temas, descrições extensas, crédito e débito, várias datas e valores grandes. Valide a adaptação entre coluna mobile e linha desktop, sem truncar conteúdo essencial nem quebrar os valores desnecessariamente.

## Filtros, seleção e busca

- Em telas densas, prefira um botão de funil próximo da ação principal, abrindo um modal. Indique a quantidade de filtros aplicados.
- Separe os filtros em edição dos filtros aplicados. “Aplicar filtros” confirma; fechar ou cancelar descarta a edição. “Limpar filtros” limpa a edição, que será confirmada ao aplicar.
- Reinicie a paginação quando os filtros aplicados mudarem.
- Não peça IDs que o usuário teria de descobrir. Ofereça seletores pesquisáveis com nomes e contexto útil.
- Para membros, mostre nome e situação. Para períodos, número, situação e data. Preserve IDs como strings no envio à API.
- Inclua “Todos”, estado de carregamento, nenhum resultado, erro e opção de tentar novamente.
- A busca deve ignorar maiúsculas e acentos. Carregue todas as páginas necessárias ou use busca paginada no servidor; não limite silenciosamente aos primeiros registros.
- Se a busca expandida reduzir demais a área da lista no celular, use uma etapa própria dentro do modal: título, voltar, campo de busca e lista rolável. Oculte os outros filtros durante essa etapa.
- Use campo de busca com cerca de 44 px de altura e fonte de 16 px no celular, evitando zoom automático. Não abra o teclado automaticamente no mobile.
- Durante a seleção, Enter na busca não deve aplicar ou fechar o formulário. Escape volta aos filtros; fora da seleção, fecha o modal. Restaure o foco ao controle de origem.

## Modais e responsividade

- Use o componente `Modal` e controles semânticos. Preserve foco, fechamento por teclado e nomes acessíveis.
- Centralize o modal no desktop, com largura máxima adequada ao conteúdo. Para filtros simples, aproximadamente 480 px é uma boa referência.
- No celular, use margens laterais pequenas e simétricas, como 12 px. O conteúdo deve ocupar toda a largura interna disponível.
- Limite a altura à área visível. Considere `visualViewport` quando o teclado exigir ajuste de altura ou posição.
- Dê altura definida ao modal de seleção e deixe a lista ocupar o restante, com rolagem própria. Cabeçalho e busca devem permanecer acessíveis.
- Em cadeias flex, use `min-height: 0` para permitir a rolagem interna; use `align-items: stretch` e impeça quebra de colunas indesejada.
- Não reutilize `.toolbar` em listas ou seletores com layout próprio. Ela possui regras globais de alinhamento e quebra que podem comprimir e deslocar o conteúdo.
- Inspecione a cascata de CSS, inclusive regras globais de botões no tema escuro. Não corrija deslocamentos com margens arbitrárias ou `overflow: hidden` que apenas esconda o problema.
- Busca e lista devem ter a mesma largura útil, sem grandes áreas vazias laterais.

## Consistência visual e acessibilidade

- Utilize a skill `ui-ux-pro-max` em trabalhos de interface e consulte seus critérios relevantes. A skill complementa estas regras e as instruções do usuário.
- Reutilize tokens do projeto para superfícies, texto, bordas e cores. Confira os temas claro e escuro visualmente.
- Mantenha contraste, foco visível, labels de formulário e navegação por teclado. Situações financeiras não devem depender apenas da cor.
- Use a família de ícones existente. Se faltar um ícone necessário, crie um SVG coerente com os demais. Oculte ícones decorativos dos leitores de tela.
- Mostre carregamento, erro, vazio e sucesso de maneira distinta. Nunca substitua falhas de consulta por saldos ou contagens zerados.

## Dados e valores financeiros

- Use os totais oficiais da API. Não apresente a soma da página atual como total da loja ou de todos os resultados.
- Cards de cobrança por membro devem mostrar o valor já rateado, incluindo acréscimo quando aplicável. Não some o acréscimo novamente.
- No extrato do período, inclua parcelas aplicáveis ao ciclo, inclusive de despesas de períodos anteriores, e despesas gerais registradas no período. Preserve o tratamento de cancelamentos definido pela API.
- Diferencie “Total da despesa”, “No período” e “Por membro”. Despesas que não sejam rateáveis nem individuais têm valor por membro igual a zero e não alteram cobranças dos membros.
- Quando houver acréscimo, mostre uma linha explícita no extrato e no PDF, além de incluí-lo nos valores de cobrança correspondentes.
- Períodos fechados usam valores e demonstrativos preservados no fechamento; períodos abertos usam a prévia oficial. Não recalcule o histórico usando o cadastro atual dos membros.
- Faça somas monetárias em centavos e preserve a regra oficial de divisão e arredondamento. Não force igualdade entre totais que representam conceitos diferentes.
- Identifique valores originais como originais. Não os apresente como saldo a pagar quando cancelamentos ou outros abatimentos não estiverem disponíveis.
- Preserve o contexto de loja, sessão e filtros durante consultas e exportações. Ignore resultados antigos após mudanças de contexto.

## Exportação em PDF

- Trate o PDF como prestação de contas: compacto, legível e adequado à impressão. Não replique os cards grandes da interface.
- Use geração vetorial/textual, como `jsPDF` com `jspdf-autotable`, já disponíveis no projeto. Evite capturas de tela para relatórios tabulares.
- Inclua identificação da loja, título, período ou filtros aplicados, data de emissão, situações relevantes e numeração de páginas.
- Organize em resumo e extrato detalhado, com totais claramente identificados. Use tabelas compactas, cabeçalhos repetidos e valores monetários alinhados à direita.
- Preserve nomes longos e conteúdo completo nas quebras de linha e página. Não corte linhas nem sobreponha cabeçalhos e rodapés.
- Use a mesma fonte de dados e as mesmas regras de apresentação na tela e no PDF. Alterações de campos ou movimentos precisam ser verificadas nos dois.
- Ao exportar uma listagem filtrada, inclua todos os resultados dos filtros aplicados, começando pela primeira página, não apenas a página visível.
- Se uma página falhar ou houver inconsistência detectável, não baixe um relatório parcial. Informe o erro e permita tentar novamente.
- Mostre progresso, impeça exportações duplicadas e não conclua o download com dados de outra loja, sessão ou seleção. Uma coleta paginada não equivale a um snapshot transacional; quando essa consistência for necessária, use suporte da API.
- Não altere dados nem feche períodos para gerar PDF. A exportação deve funcionar tanto para períodos abertos quanto fechados.

## Verificação antes de concluir

- Execute o build e os testes pertinentes à mudança. Não crie testes que apenas repitam detalhes de implementação.
- Confira visualmente a tela real ou fixtures representativas. Não se limite a verificar ausência de overflow.
- Para mudanças de layout responsivo, confira 320, 390, 768, 1024 e 1440 px, além de uma altura curta, como 420 px, quando houver modais ou buscas.
- Verifique margens simétricas, largura dos campos, área visível da lista, rolagem, textos longos, seleção, aplicação/cancelamento e navegação por teclado.
- Teste ambos os temas. Confira o comportamento mobile com teclado; viewport curto é uma verificação complementar, não uma simulação completa do teclado real.
- Faça testes que detectem a regressão encontrada, como largura da busca/lista e alinhamento do modal, em vez de apenas salvar screenshots.
- Para PDF, gere um arquivo de teste, renderize as páginas e inspecione o resultado. Verifique também o texto extraído e um relatório com várias páginas.
- Confira no PDF as despesas individuais e gerais, acréscimos, totais, valores por membro e períodos abertos/fechados quando pertinentes. Não ofereça PDFs com dados de teste como relatórios reais do usuário.

## Limite entre projetos

- Este repositório contém o app web. `../entre-colunas-api` deve conter somente a API, sem frontend.
- Se alterar a API, leia as instruções daquele repositório, atualize a documentação OpenAPI e execute os checks exigidos lá.
