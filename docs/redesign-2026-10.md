# Redesign — direção marinho/dourado

Implementação baseada no guia de auditoria de 29/10/2026. As gravações de verificação usam fixtures do Playwright; não foram executadas operações financeiras em dados reais.

## Entregue

- Tokens marinho/dourado, tipografia de interface sem serifa, componentes compartilhados e dois temas.
- Painel Bento com proporção 6/3/3, indicadores navegáveis, referência de cálculo e período antes das movimentações no celular.
- Receber pagamento abre o formulário no tipo correto; despesas a pagar abre a lista filtrada.
- Navegação recolhida até 1023 px. No celular: Geral, Membros, Períodos, Caixa e Mais. O nome completo “Mensalidades e períodos” permanece no menu.
- Data civil de ingresso preservada, sem conversão de fuso. Instantes de operações continuam usando a data local.
- Despesa totalmente cancelada sem ação de pagamento e com indicação de que pagamento não se aplica. Tipos traduzidos e categoria obtida do catálogo.
- Indicador de pagamento explica que altera o caixa administrativo sem registrar movimento contábil.
- Uma linha por operação no Caixa; quantidade de operações e movimentos diferenciadas. Valores de movimentos de contas distintas não são somados nem apresentados como valor único do evento.
- Identificação de conta da loja/do membro por consulta às contas, com IDs preservados e erro recuperável quando a identificação não estiver disponível.
- Busca visível por nome; posição financeira consolidada na lista de membros; tempo desde pagamento com apresentação neutra, sem inferência de atraso.
- Ações Editar, Arquivar e Excluir explicitamente nomeadas.
- Correção de despesa mostra alterações antes/depois e avisa quando uma mudança estrutural compensará o débito vigente e criará nova programação.
- Despesas usam comparação em tabela no desktop largo e lista leve no celular; a tabela deixa juntos categoria, tipo, programação, estado administrativo, pagamento e valor original.
- Correção de despesa envia a revisão `updated_at` exibida no formulário. Se outro operador alterar o registro antes do envio, a API responde conflito antes de criar auditoria ou movimentos.
- Troca de registro pela mesma rota invalida a tela anterior usando os parâmetros de navegação como parte da identidade da página.
- Explicação de saldo contábil junto ao valor. A implementação existente do resumo administrativo foi consultada para fundamentar a descrição; fórmulas não foram alteradas.
- Busca na revisão de fechamento, total das novas cobranças e diferenças não cobradas somadas em centavos, com detalhamento por parcela.
- “Prévia do período” na cobrança individual e no PDF; linguagem de configurações sem referência interna à API.

## Limites e próximas entregas

O guia contém também propostas de evolução que não devem ser confundidas com esta implementação:

- A central de relatórios dá acesso às quatro fontes existentes; cada PDF continua sendo gerado na tela de origem com os filtros e contexto daquela consulta. CSV e instrumentação de uso permanecem como evolução.
- O antes/depois do formulário não substitui o histórico completo de auditoria, que permanece acessível pelas operações e trilha financeira existentes.
- A busca por nome percorre todas as páginas; não foi adicionada ordenação global por dívida. Ordenar apenas a página visível produziria informação enganosa.
- Não foram acrescentados vencimento, competência mensal, meio de pagamento, comprovante, saldo previsto no pagamento ou saldo inicial/final do intervalo.
- O fechamento usa transação e bloqueio da loja, recalcula a composição ao confirmar e exige o fingerprint SHA-256 da prévia revisada. Se a composição mudar entre revisão e confirmação, a API responde conflito e nenhum fechamento é gravado; a interface descarta a revisão para exigir novo cálculo. O contrato da API e o OpenAPI foram atualizados.
- Definir destino financeiro para diferenças de arredondamento continua pendente de decisão de domínio. A revisão atual mostra os valores não cobrados sem atribuí-los a uma conta.
- Não foram alteradas permissões, vigência de valores, captura do quadro, regras de estorno ou exclusão, nem os cálculos e arredondamentos.
- Aparelho físico com teclado virtual e leitor de tela permanecem sem validação. Viewport curto e testes de teclado não substituem essa avaliação.

## Verificação

Build de produção e 56 testes unitários passaram. A suíte E2E completa passou: 100/100 casos para desktop e mobile, usando dois workers. Build e lint passaram nos dois repositórios. A suíte integral da API passou com 199 testes; 25 testes e 6 suítes que exigem banco foram ignorados porque as URLs de teste não estavam configuradas. Os testes de rota e OpenAPI cobrem também a recusa de versões antigas do fechamento e da correção de despesa. Casos de interface cobrem ingresso em fusos diferentes, cancelamento sem ação de pagamento, operação sem duplicação de linhas, identificação de conta, menu Mais com retorno de foco, largura dos rótulos inferiores, tabela/lista responsiva, revisão do fechamento e recuperação após conflito concorrente. Inspeção visual nos dois temas em 320, 390, 768, 1024 e 1440 px e modais em altura de 420 px. PDF de cobrança com cinco páginas renderizado e texto extraído, incluindo a ressalva de prévia.
