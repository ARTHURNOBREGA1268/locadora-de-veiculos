# Plano do sistema: precificação e locações

## Objetivo
Manter a API como fonte autoritativa do sistema, com o frontend consumindo endpoints internos. O módulo de precificação conserva o cálculo do backend, autorização ADMIN para configuração e snapshot imutável na confirmação. O módulo de locações passa a ter cadastro, listagem administrativa, visão do cliente, dados operacionais e histórico compatíveis com o formato especificado, sem edição manual de status e sem exclusão física de registros.

## Arquitetura e pastas
- `backend/prisma/schema.prisma` e `backend/prisma/migrations/`: dados relacionais de clientes, locações, motoristas, itens vinculados, cobranças, pagamentos, vistorias e histórico.
- `backend/src/services/locacao.service.js`: regras transacionais de disponibilidade por período, criação/edição/cancelamento, transições automáticas, vistoria e snapshots.
- `backend/src/controllers/`, `backend/src/routes/`, `backend/src/app.js`: APIs REST autenticadas, com escopo USER por cliente vinculado e visão administrativa exclusiva para ADMIN.
- `backend/src/services/precificacao.service.js`: mantém a cotação e preço congelado; itens relacionais devem reproduzir os valores calculados pelo backend.
- `frontend/src/pages/Locacoes.jsx`, `frontend/src/components/LocacaoList.jsx` e `LocacaoForm.jsx`: tabela responsiva com detalhe por seções; reserva, cliente, período, logística, vistoria e visão financeira conforme papel.
- `backend/test/`: regressões de migration, autorização, disponibilidade concorrente, transições, cobranças e snapshot.

## Decisões de domínio para locações
1. `Cliente` é uma entidade separada de `Usuario`. `Cliente.usuarioId` será opcional e único para associar um login USER a um cadastro de cliente; ADMIN pode cadastrar clientes sem login. CPF é opcional/único para preservar contas históricas sem CPF e habilitar busca por nome ou CPF quando informado. Usuários existentes serão migrados para cadastros de cliente associados, sem inventar CPF. O vínculo pode ser alterado apenas antes da primeira locação; depois torna-se imutável para impedir transferência de acesso ao histórico.
2. `Locacao.clienteId` referencia `Cliente`; `atendenteId` referencia `Usuario` e registra o ADMIN que criou a reserva em nome de outra pessoa. USER só consulta e opera locações do Cliente vinculado à própria conta; ADMIN tem a visão administrativa. Totais e caução são visíveis ao titular de sua reserva e a ADMIN, não a outros usuários.
3. O campo de categoria na locação é snapshot da categoria reservada, mesmo se o veículo for reclassificado depois. `codigo` é gerado pelo backend e somente leitura. Campos calculados, financeiros e derivados de vistorias nunca são aceitos como autoridade do payload do navegador.
4. A migration será incremental, preservando IDs, preços, datas e estados. Campos históricos sem fonte (categoria congelada, origem e filiais) permanecem `NULL`; novas reservas sempre recebem categoria e filiais validadas pelo serviço. Nomes SQL usam snake_case e o DTO HTTP permanece camelCase. FKs históricas usam restrição; registros são cancelados/inativados, nunca apagados.
5. O status continua exclusivamente pela máquina atual `reservada → retirada → em_andamento → devolvida → finalizada`, com cancelamento apenas antes da retirada. Cada mudança grava `locacao_status_historico` na mesma transação. Retirada/devolução reais, km e combustível são registrados por transições e vistorias, não por edição livre de status.
6. Pagamentos são um razão de eventos somente leitura na UI. O projeto não possui gateway: dados operacionais reais não simulam captura, estorno ou caução retida, e pagamentos reais permanecem pendentes até integração/registro explícito. Exceção apenas para os registros fictícios identificados como `DEMO` pelo seeder, que existem para demonstração visual e nunca representam liquidação ou eventos de gateway.
7. Totais, diárias, adicionais, proteções, descontos, promoção, caução e contrato usam snapshot. Cotações novas e alterações administrativas nunca mudam o histórico confirmado.
8. Vistorias validam os itens ativos e obrigatórios e guardam respostas/descrições como snapshot JSON. ADMIN pode incluir cobranças avulsas após devolução e antes de finalizar, criando saldo pendente; pode também registrar uma vez a assinatura física do texto contratual congelado, sem simular gateway ou assinatura digital.

## Regras já implementadas de precificação
1. A fórmula de custos gera o mínimo diário recomendado. A tarifa base por categoria é o preço publicado e não pode ficar abaixo do maior entre esse mínimo e o piso configurado.
2. Tarifas semanais e mensais são totais por pacotes de 7 e 30 diárias; o motor compara composições possíveis e escolhe a menor válida.
3. Regras dinâmicas são processadas por prioridade crescente; percentuais aplicam-se sequencialmente e ajustes fixos são por diária. Regra não acumulável não se soma a outra regra dinâmica elegível.
4. Cupom e fidelidade reduzem somente o subtotal das diárias, limitados ao excedente acima do custo mínimo e do piso configurado; a API indica quando limita um desconto. Adicionais, proteções e caução ficam separados; impostos/taxas são calculados após os descontos. Caução não integra o total, mas seu valor vigente é congelado no snapshot.
5. O limite de uso de cupom por cliente usa registro individual ligado a cliente/locação além do contador total. Custos operacionais ausentes são configuráveis e não são preenchidos com valores fictícios.

## Fórmula de referência
- Depreciação diária: `(valor de compra − valor de revenda estimado) / (vida útil em meses × 30)`.
- Custos fixos mensais: capital/financiamento + IPVA + seguro + licenciamento + estrutura administrativa rateada.
- Custos variáveis mensais: custo de manutenção por km × km médio diário × 30 + limpeza por locação × 30 / dias médios da locação.
- Custo por diária efetivamente alugada: `(custo fixo mensal + custo variável mensal) / (30 × ocupação alvo)`.
- Preço mínimo diário recomendado: `custo por diária alugada / (1 − margem desejada)`; depois aplicam-se fatores tarifários elegíveis.
- Valores monetários permanecem em `DECIMAL`; a API arredonda para centavos segundo política única e valida totais antes de persistir.

## Fluxos e API
1. ADMIN mantém clientes, parâmetros, tarifas e demais cadastros. USER autenticado reserva para o Cliente associado à própria conta; ADMIN pode selecionar Cliente por nome/CPF e registrar o atendente.
2. `POST /locacoes` recebe seleções de cliente/veículo/período/logística e itens permitidos; API valida disponibilidade do intervalo e regras, calcula preço e grava locação, itens e snapshot numa transação.
3. `GET /locacoes` retorna somente locações próprias ao USER e lista administrativa ao ADMIN; `GET /locacoes/:id` verifica propriedade ou papel ADMIN. DTOs minimizam campos pessoais/financeiros de terceiros.
4. Transições de retirada, início, devolução, finalização e cancelamento têm endpoints dedicados; não existe seletor manual livre de status. Vistorias atualizam km, combustível e referências conforme tipo.
5. Histórico mostra preço congelado, itens, pagamentos pendentes/registrados, cobranças, vistorias, contrato e timeline de status sem recalcular valores antigos.

## Compatibilidade
Não usar `Veiculo.valorDiaria` silenciosamente como fallback. Tarifas legadas exigem migration explícita ou cadastro de tarifa base. Para locações antigas, backfill preserva campos existentes, associa Cliente pela conta USER e mantém campos operacionais desconhecidos como NULL.


## Catálogo público e organização da navegação
- A rota pública `/catalogo` consome endpoints REST de leitura do próprio backend para veículos disponíveis e um subconjunto curado das regras comerciais; nenhum dado administrativo de identificação/documentação/custo é exposto.
- O catálogo apresenta informações de produto, filtros de busca e regras de locação configuradas. Não publica preço fixo do veículo: a cotação continua sendo calculada pela API somente depois de informar o período, a categoria e as opções.
- A ação de reservar navega para `/locacoes?veiculoId=<id>`; o fluxo protegido conserva o destino através do login/cadastro, pré-seleciona o veículo e deixa o serviço de locação recalcular o total.
- O CRUD `/veiculos` é uma área de frota ADMIN-only, sem botão de reserva nem exibição de `valorDiaria`; preços permanecem em `/precificacao` e as tarifas não são editadas no cadastro operacional.
- A navegação prioriza Catálogo e Locações; administração segue Clientes, Frota, Precificação, Configurações e Usuários. Visitantes veem Catálogo, Entrar e Criar conta; USER vê Catálogo e Minhas locações.
- A interface reaproveita a paleta e os componentes do dashboard existente, com hero ilustrativo, busca/filtro por categoria, cards adaptáveis a telas pequenas e regras em blocos legíveis. A foto não representa disponibilidade real; não se mostra tarifa fixa, porque a API só pode cotar após receber datas e opções.


## Padronização visual, responsividade e dados de demonstração
- Todas as rotas existentes compartilham `Layout` e `.conteudo`; esse contêiner ocupa 90% da largura disponível, centralizado e fluido, inclusive em `/catalogo`, Locações, Frota e páginas administrativas. O cabeçalho acompanha a mesma malha.
- Campos de formulário usam altura-alvo uniforme de 44 px, tipografia, borda, foco e espaçamento consistentes; checkbox, radio, range, arquivo, toggles e textarea mantêm dimensões semânticas próprias. Grids usam `minmax(0, 1fr)`/`auto-fit` para não forçar overflow.
- A responsividade está aplicada no CSS compartilhado e nos pontos específicos de navegação, formulário, tabelas, modais, filtros e cartões. Em telas estreitas, layouts empilham, controles de ação ocupam a largura disponível e tabelas extensas mantêm uma área explícita de rolagem em vez de cortar conteúdo.
- Login reutiliza a marca, paleta e imagem de catálogo já presente no projeto; adota composição editorial em duas colunas em desktop e empilhada em mobile, formulário acessível, visibilidade de senha e retorno seguro ao veículo escolhido.
- O seeder compõe um conjunto fictício de demonstração por módulos (contas/clientes, cadastros da frota, configurações, pricing, reserva e históricos relacionados) com chaves estáveis, upserts vazios e verificações de identificadores reservados. Não altera cadastros/configurações preexistentes nem apaga registros; completa apenas referências ausentes da locação reservada DEMO. A execução de demonstração é bloqueada em produção por padrão, e o campo legado `Veiculo.valorDiaria` não é usado como tarifa.


## Correções técnicas do enunciado, preservando arquitetura vigente

Preservar a separação `Usuario`/`Cliente`, a relação de locação com `Cliente`, o fluxo de reserva aprovado, o cadastro de frota restrito a `ADMIN` e o preço por categoria no módulo de precificação. Não reintroduzir `valorDiaria` no CRUD veicular nem transformar cadastro de veículo em operação de USER. Corrigir os desvios técnicos compatíveis: mapear falha de serialização Prisma `P2034` para HTTP 409, permitir que USER aplique `?disponivel=true|false` dentro da lista pública permitida, remover componentes veiculares legados sem importadores, suprimir comentários manuais das áreas apontadas pelo item 37 e comprovar duas solicitações de reserva concorrentes na integração real MySQL. O teste real continua opcional em execução local sem banco, mas é executado no job MySQL 8 do CI. O repositório foi transferido para `ARTHURNOBREGA1268/locadora-de-veiculos`; o README agora usa a URL de clone do novo proprietário.
