# Entre Colunas Web

PWA em **Vue 3 + TypeScript + Vite**, independente do Expo, React e React Native. Usa a mesma API do aplicativo móvel. As telas são carregadas por rota; os ícones SVG são importados individualmente e não há biblioteca de componentes de interface em runtime.

## Executar

Requer Node.js 22.12+ (ou 24 LTS) e npm.

```bash
npm install
cp .env.example .env
npm run dev
```

Abra http://localhost:5173. Entre com uma conta existente da API. O backend precisa estar disponível; o projeto não inclui credenciais ou dados fictícios no aplicativo.

O `.env` padrão usa `VITE_API_URL=/api`. Em desenvolvimento, o Vite encaminha `/api/*` para `API_PROXY_TARGET=http://localhost:3001`, evitando a necessidade de CORS no backend. Para usar outra API, altere `API_PROXY_TARGET` e reinicie o Vite. Para acessar de outro dispositivo, use o IP deste computador e mantenha o backend no destino do proxy.

## Funcionalidades

- Login, restauração por aba, expiração pelo TTL da API e saída com descarte de dados da sessão.
- Seleção de loja com limpeza dos dados exibidos e proteção contra respostas atrasadas.
- Visão geral com caixa administrativo, despesas a pagar e valores a receber lidos do resumo oficial da API.
- Membros: paginação, filtro de situação, busca na página, cadastro, edição, arquivamento e exclusão com confirmação.
- Extratos da loja e dos membros, filtros de data, saldo global e consulta aos débitos por período.
- Despesas: filtros, cadastro, correção com justificativa, programação de parcelas, marcação de pagamento e cancelamento de parcelas elegíveis.
- Períodos: abertura, quadro capturado, prévia detalhada, revisão e fechamento explícito; consulta aos demonstrativos de períodos fechados.
- Operações: entradas, pagamentos de membros, ajustes da loja e de membros, saldos iniciais, consulta aos lançamentos e estornos com justificativa.
- Configuração dos valores mensais e criação, edição e ativação/desativação de categorias próprias.
- Layout responsivo, temas claro/escuro, navegação por teclado e estados de carregamento, erro e vazio.

IDs BigInt permanecem strings. Regras de despesas e clientes HTTP foram portados do código móvel para `src/domain`; não há dependência do projeto irmão para compilar ou executar.

## PWA e segurança da sessão

O build gera manifesto, ícones comuns e maskable e service worker. A instalação funciona em contexto seguro (HTTPS, ou localhost para desenvolvimento), conforme suporte do navegador. No iPhone/iPad, abra no Safari e use Compartilhar → Adicionar à Tela de Início. O botão de instalação oferece instruções quando o navegador não fornece o prompt automático.

O service worker guarda somente arquivos estáticos. Não há cache de respostas da API, tokens, cadastros ou movimentos financeiros. A estrutura pode abrir sem internet após a primeira visita ao build; consultar e gravar dados exige conexão. Não há fila de lançamentos offline nem notificações push.

A sessão usa memória e `sessionStorage`, sem persistir a senha e sem prometer o armazenamento seguro nativo. Fechar a aba encerra essa persistência. Cookies HttpOnly exigiriam uma mudança no contrato Bearer do backend. O prazo de expiração é conferido em timer e ao retornar à aba.

Lançamentos financeiros persistem a intenção e a chave de idempotência na mesma aba **antes do envio**. Se a conexão cair ou o resultado for incerto, um aviso permite reenviar o mesmo corpo e a mesma chave, inclusive após recarregar a página. Novas intenções com conteúdo diferente são bloqueadas enquanto houver uma pendente. Uma atualização de versão depende da ação do usuário, para evitar recarga automática no meio de um formulário.

## Build e publicação

```bash
npm run build
npm run preview
```

`dist/` contém os arquivos para hospedagem. O preview serve para inspecionar o build/PWA: ele **não possui o proxy de API do servidor de desenvolvimento**. Configure uma URL HTTPS de API com CORS em `.env.production` antes do build, ou use o proxy `/api` da hospedagem.

O exemplo [deploy/nginx.conf](deploy/nginx.conf) serve a SPA com fallback das rotas, política de cache e proxy da API. Ajuste domínio, diretório e destino do backend e configure HTTPS na infraestrutura. Nunca encaminhe `/api` para o fallback HTML. Não foi feita publicação externa.

Variáveis `VITE_*` são públicas e incorporadas ao build. Nunca coloque senhas ou segredos nelas. Com API em domínio separado, libere explicitamente a origem da PWA e os headers `Authorization`, `Content-Type` e `Idempotency-Key` no CORS do backend.

## Verificação

```bash
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm run test:pwa
npm audit
```

Testes de unidade verificam isolamento de contas em fechamentos coletivos, valores financeiros inválidos, IDs grandes e regras de despesas. Os testes de navegador exercitam fluxos reais da interface com **respostas de API controladas**, em desktop e celular. Eles não gravam no banco de dados de produção. A documentação OpenAPI local foi consultada para conferir os contratos; a homologação com uma conta real e o banco de destino deve ocorrer antes da publicação.

## Docker e Dokploy

A imagem serve a aplicação com Nginx na porta **80**. As variáveis abaixo são
lidas ao iniciar o container, permitindo reutilizar a imagem sem novo build:

```dotenv
VITE_API_URL=/api
API_PROXY_TARGET=http://seu-backend:3001
```

Com `/api`, o Nginx encaminha as chamadas ao `API_PROXY_TARGET`, removendo o
prefixo `/api`, como no desenvolvimento. Use o nome/endereço do backend acessível
pela rede do container; `localhost` aponta para o próprio container. O destino
aceita HTTP(S), porta e caminho, sem credenciais ou query string.

Para acessar uma API diretamente pelo navegador, defina
`VITE_API_URL=https://api.seudominio.com` e configure CORS no backend.
`VITE_API_URL` é pública; nunca coloque segredos nela. Outras variáveis `VITE_*`
adicionadas futuramente precisam ser incluídas explicitamente na configuração de
runtime antes de poderem ser alteradas dessa forma.

No Dokploy:

1. Selecione o tipo de build **Dockerfile**, com caminho `Dockerfile` na raiz.
2. Na aba **Environment**, cole as variáveis do seu `.env` e salve.
3. Configure o domínio para a porta interna **80** e habilite HTTPS.
4. Faça o deploy. Após alterar variáveis, recrie/reimplante o container para
   aplicar os valores e recarregue a página no navegador.

Localmente:

```bash
docker build -t entre-colunas-web .
docker run --rm --name entre-colunas-web -p 8080:80 --env-file .env entre-colunas-web
```

O `.env` fica fora da imagem por meio do `.dockerignore`. O Docker lê o arquivo
com `--env-file`; no Dokploy, as mesmas variáveis são fornecidas pelo painel.
O arquivo público `runtime-config.js` é gerado na inicialização e fica fora do
cache do service worker.

### Acompanhamento e relatório do período

Em **Períodos > Acompanhar período**, a visão geral apresenta três cards de cobrança e contagem: ativos com ágape, ativos sem ágape e afastados. A classificação usa o quadro capturado na abertura. Os cards destacam o valor por membro já rateado, com o acréscimo incluído para os ativos; o total do grupo aparece como informação secundária. Quando há despesas individuais diferentes, o destaque mostra a faixa de cobrança por membro.

O extrato inclui somente as parcelas de rateio e individuais programadas (período aberto) ou lançadas (fechado) no ciclo, inclusive de despesas cadastradas antes. O quadro de membros e os demonstrativos ficam na aba **Membros**.

**Exportar PDF** baixa o mesmo resumo com os três cards e o extrato completo, com paginação automática. Em períodos abertos, os valores são uma prévia com o acréscimo por ativo informado na tela, compartilhado com a revisão de fechamento. Em fechados, são usados os valores gravados nos demonstrativos, incluindo o acréscimo do fechamento. Saldos anteriores, pagamentos e ajustes já lançados não compõem os totais de novas cobranças.

Requer a versão da API com `GET /lodge/:lodgeId/financial/periods/:periodId/report`.

Cada despesa no extrato do período informa seu valor total, o valor da parcela no ciclo e o valor por membro (com o divisor usado), tanto na tela quanto no PDF. O rateio considera os destinatários do quadro capturado e trunca a divisão em centavos, como no fechamento; despesas individuais têm divisor 1. Sem destinatários elegíveis, o valor por membro fica indisponível.

Quando houver acréscimo por ativo, o extrato e o PDF apresentam uma linha própria com o valor por membro, a quantidade de ativos e o valor total. O rodapé **Total do extrato** soma parcelas de rateio, individuais e esse acréscimo; os valores dos cards já incluem o acréscimo e não são recalculados por essa linha.

O PDF usa um formato de prestação de contas para impressão: cabeçalho e dados do período em poucas linhas, tabela de cobranças por perfil e extrato detalhado com totais. Os valores exportados usam os mesmos dados da Visão Geral e do Extrato. Relatórios longos repetem o cabeçalho da tabela e exibem numeração de páginas.
