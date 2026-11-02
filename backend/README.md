# Locadora de Veículos — Backend

API REST e núcleo das regras de negócio do sistema de locação de veículos. No repositório consolidado, a interface React fica na pasta irmã `../frontend`; o MySQL é acessado somente pelo backend. A API escuta em loopback por padrão e o frontend a acessa pelo proxy `/api`.

## Descrição
Uma locadora cadastra veículos, controla a disponibilidade e registra as locações feitas por usuários autenticados. O sistema calcula o valor das locações, preserva o histórico e impede duas locações ativas para o mesmo veículo.

## Funcionalidades
- Cadastro e login de usuários, com senha em hash (bcrypt) e autenticação por JWT
- Papéis USER e ADMIN; usuários públicos são sempre USER
- Gestão administrativa de usuários (listar, criar, editar, atribuir USER/ADMIN e ativar/inativar), além do cadastro de veículos restritos a ADMIN
- Gestão administrativa da frota: cadastro/edição de identificação, características, situação operacional, dados financeiros/documentais, categoria, filial e opcionais; a tarifa não faz parte do CRUD de veículos
- Catálogo público com veículos disponíveis, busca e regras comerciais curadas; dados de placa, documentação, custos e tarifa legada não são expostos
- Histórico administrativo por veículo: manutenções, sinistros/avarias, multas e vistorias; vínculos de locação são validados
- Precificação API-first: custos operacionais, ocupação, margem, tarifas por categoria/vigência, regras dinâmicas, adicionais, proteções, cupons, fidelidade, impostos e taxas
- Cotação discriminada no backend e congelamento do preço no mesmo commit transacional da reserva; futuras alterações de preço não mudam o histórico
- Registro de locação com recálculo autoritativo no backend (qualquer fração de 24 horas conta como diária completa)
- Listagem das locações do usuário autenticado, com os dados do veículo
- Fluxo explícito e transacional: reservada → retirada → em_andamento → devolvida → finalizada, ou reservada → cancelada; liberação do veículo na devolução/cancelamento
- Acesso restrito ao dono da locação

## Integrantes
- Nome completo
- Nome completo

## Tecnologias
Node.js, Express, Prisma ORM, MySQL, JWT, bcrypt, React (pasta `frontend/`)

## Requisitos
- Node.js 20 ou superior
- MySQL 8 ou superior, com acesso ao banco `locadora` para aplicação das migrations

## Instalação e execução

### Backend
1. A partir da raiz do repositório consolidado, entrar na pasta do backend: `cd backend`
2. Instalar as dependências do lockfile: `npm ci`
3. Gerar o Prisma Client: `npx prisma generate`
4. Criar o banco: `CREATE DATABASE locadora CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
5. Copiar `.env.example` para `.env` e preencher:

| Variável | Descrição | Exemplo |
|---|---|---|
| DATABASE_URL | Conexão com o MySQL | `mysql://usuario:senha@localhost:3306/locadora` |
| JWT_SECRET | Segredo para assinar tokens; obrigatório e com pelo menos 32 caracteres | `openssl rand -base64 32` |
| JWT_EXPIRES_IN | Validade do token | `1d` |
| HOST | Interface de rede em que a API escuta; mantenha loopback atrás de um proxy no mesmo host | `127.0.0.1` |
| PORT | Porta da API | `3333` |
| CORS_ORIGIN | Origem permitida para chamadas cross-origin | `http://localhost:5173` |

Caracteres especiais na senha do banco devem ser codificados na URL (`@` vira `%40`).

Gere um segredo local com `openssl rand -base64 32` e preencha `JWT_SECRET` somente no arquivo `.env`. O servidor recusa iniciar se o segredo estiver ausente ou tiver menos de 32 caracteres. Nunca versione nem compartilhe o valor gerado.

As datas de locação devem ser enviadas como ISO 8601 com fuso horário explícito, por exemplo `2030-01-01T10:00:00.000Z`. Datas de calendário impossíveis, horários inválidos e datas locais sem fuso são rejeitados com HTTP 400.

6. `npx prisma migrate deploy` (aplica as migrations versionadas em `prisma/migrations`, incluindo os campos `ativo` e `tokenVersion`)

Em alterações locais do schema, use `npx prisma migrate dev --name nome_da_migration`; regenere o client com `npx prisma generate` (com `DATABASE_URL` configurada). Em CI/produção aplique migrations com `npx prisma migrate deploy`.
7. `npm run seed` (cria o usuário de exemplo e 4 veículos)
8. `npm run dev` (a API sobe em `http://127.0.0.1:3333` por padrão)

A migration `20261101180000_add_usuario_papel` adiciona a coluna `Usuario.papel` com default `USER`; as contas existentes recebem `USER` sem alteração dos demais dados. O cadastro público sempre cria uma conta USER. Para preparar uma conta ADMIN, cadastre uma conta separada com senha forte e promova-a localmente, substituindo o e-mail pelo da conta criada:

```bash
npm run admin:promote -- admin@exemplo.com
```

O comando requer acesso ao `DATABASE_URL` do ambiente e a confirmação digitada `PROMOVER`; ele não cria contas nem expõe endpoint HTTP de promoção. Não promova a conta demo `demo@locadora.com` sem antes substituir a senha padrão `123456` por uma senha forte e única.

### Frontend
1. A partir da raiz do repositório consolidado, entrar na pasta do frontend: `cd frontend`
2. Instalar as dependências do lockfile: `npm ci`
3. Copiar `.env.example` para `.env`, manter `VITE_API_URL=/api` e usar `API_PROXY_TARGET=http://127.0.0.1:3333` no proxy local do Vite
4. `npm run dev` e acessar `http://localhost:5173`

## Dados de exemplo
Usuário: `demo@locadora.com` / senha `123456`
Veículos do seed: Fiat Mobi, Chevrolet Onix, Volkswagen T-Cross e Toyota Corolla.

## Rotas
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | /auth/register | não | Cadastra usuário |
| POST | /auth/login | não | Retorna o JWT |
| GET | /auth/me | sim | Dados do usuário autenticado |
| GET | /catalogo/veiculos | não | Lista veículos disponíveis com DTO comercial seguro |
| GET | /catalogo/regras | não | Consulta regras divulgáveis de locação; exclui contrato e configuração interna |
| GET | /usuarios | sim, ADMIN | Lista usuários ativos e inativos sem senhaHash |
| POST | /usuarios | sim, ADMIN | Cadastra usuário (nome, email, senha; papel USER/ADMIN opcional) |
| PATCH | /usuarios/:id | sim, ADMIN | Edita nome/e-mail, redefine senha, troca papel ou ativa/inativa usuário |
| POST | /veiculos | sim, ADMIN | Cadastra veículo |
| GET | /veiculos/metadados | sim | Lista categorias, filiais e opcionais para formulários |
| GET | /veiculos | sim | Lista veículos |
| GET | /veiculos?disponivel=true | sim | Lista só os disponíveis |
| GET | /veiculos/:id | sim, ADMIN | Consulta cadastro completo do veículo |
| PATCH | /veiculos/:id | sim, ADMIN | Edita dados cadastrais/operacionais; `valorDiaria` não é aceito |
| GET | /veiculos/:id/historico | sim, ADMIN | Lista manutenções, sinistros, multas e vistorias |
| POST | /veiculos/:id/manutencoes | sim, ADMIN | Registra manutenção |
| POST | /veiculos/:id/sinistros | sim, ADMIN | Registra sinistro/avaria |
| POST | /veiculos/:id/multas | sim, ADMIN | Registra multa, associa pela data à locação compatível e cria cobrança/saldo pendente com taxa administrativa |
| POST | /veiculos/:id/vistorias | sim, ADMIN | Registra vistoria de saída/entrada |
| POST | /locacoes | sim | Registra locação reservada |
| GET | /locacoes | sim | Lista as locações do usuário |
| GET | /locacoes/:id | sim | Consulta uma locação do usuário |
| GET | /locacoes/checklist | sim | Lista itens ativos para vistoria |
| PATCH | /locacoes/:id/retirar, /iniciar, /devolver, /finalizar, /cancelar | sim, proprietário | Executa a próxima transição permitida |
| POST | /locacoes/:id/cobrancas-extras | sim, ADMIN | Registra ocorrência até a finalização como saldo pendente |
| PATCH | /locacoes/:id/contrato-assinado | sim, ADMIN | Registra uma única vez a confirmação da assinatura física do snapshot |
| GET | /clientes/me | sim | Consulta o cadastro Cliente ligado à conta autenticada |
| GET/POST | /clientes | sim, ADMIN | Lista e cadastra clientes independentes ou vinculados a USER |
| GET | /clientes/:id | sim, ADMIN | Consulta cadastro de cliente |
| PATCH | /clientes/:id | sim, ADMIN | Edita/inativa cadastro sem exclusão física |
| GET/PUT | /configuracoes/locacao | sim, ADMIN | Consulta/atualiza configuração global, catálogos e regras |
| POST | /precificacao/cotacao | sim | Retorna uma cotação detalhada; não reserva nem bloqueia o veículo |
| GET | /precificacao/opcoes/:veiculoId | sim | Opções ativas de adicionais/proteções/convênios e caução informativa |
| GET | /precificacao/admin | sim, ADMIN | Parâmetros, custos, tarifas, regras, cadastros e histórico de preços |
| PATCH | /precificacao/configuracao | sim, ADMIN | Atualiza parâmetros gerais e taxas configuráveis |
| PUT | /precificacao/custos/:veiculoId | sim, ADMIN | Define custos operacionais para veículo |
| POST/PATCH | /precificacao/tarifas, /precificacao/tarifas/:id | sim, ADMIN | Mantém tarifas diárias/semanais/mensais por categoria e vigência |
| POST/PATCH | /precificacao/regras, /precificacao/regras/:id | sim, ADMIN | Mantém ajustes de sazonalidade, semana, antecedência, ocupação e duração |
| POST/PATCH | /precificacao/adicionais, /precificacao/adicionais/:id | sim, ADMIN | Mantém itens opcionais por diária ou locação |
| POST/PATCH | /precificacao/protecoes, /precificacao/protecoes/:id | sim, ADMIN | Mantém preços de proteções por categoria ou gerais |
| POST/PATCH | /precificacao/promocoes, /precificacao/promocoes/:id | sim, ADMIN | Mantém cupons e limites de uso |
| POST/PATCH | /precificacao/fidelidade, /precificacao/fidelidade/:id | sim, ADMIN | Mantém níveis/descontos calculados por locações finalizadas |
| PATCH | /precificacao/pisos/:categoriaId | sim, ADMIN | Define piso mínimo por categoria |
| GET | /precificacao/historico | sim, ADMIN | Consulta auditoria de alterações de preço |

Rotas protegidas exigem o header `Authorization: Bearer <token>`. A cada requisição protegida, status, papel e versão de sessão são consultados no banco. Contas inativas são bloqueadas imediatamente; redefinir senha ou inativar incrementa a versão e revoga tokens existentes, inclusive se a conta for reativada depois. O papel de autorização vem do banco, nunca do cliente/JWT. Não há exclusão física: inativar preserva histórico. Administradores não podem inativar/rebaixar a si mesmos nem remover o último ADMIN ativo; conflitos retornam 409. Cadastro público cria sempre USER ativo e ignora papel/status enviados pelo cliente.

## Configuração global de locação e estados

`GET /configuracoes/locacao` e `PUT /configuracoes/locacao` são ADMIN-only. O PUT exige o objeto completo retornado pelo GET, incluindo arrays relacionais; campos desconhecidos, limites fora dos tipos SQL, enums, booleanos e IDs de catálogos são validados antes da transação. O catálogo de proteções permite criar/editar opções e ativá-las/desativá-las; os vínculos e seleções são persistidos. Itens de checklist novos são criados sem ID local, os existentes são atualizados e os removidos da tela são inativados, preservando o registro e as respostas já congeladas em vistorias. Franquias/cauções são mantidas por categoria, inclusive categorias adicionadas posteriormente.

Migration incremental associa reservas legadas a um cadastro `Cliente` separado, preserva IDs, datas, valores e status e não inventa CPF. Categoria congelada, origem e filiais não existiam no registro antigo: esses campos permanecem `NULL` no histórico; novas locações precisam informar categoria e filiais válidas. A relação opcional `Cliente.usuarioId` vincula a conta e o cadastro.

O vínculo entre `Cliente` e conta só pode ser alterado enquanto não houver locações para esse cadastro; depois ele é imutável, para impedir que a mudança transfira a outra conta o acesso às locações históricas.

Reservas novas começam `reservada` e mantêm o veículo como `reservado`; retirada, início, devolução e finalização seguem a máquina automática e não aceitam edição manual livre. USER só lista/opera as próprias locações; ADMIN mantém a lista global. Intervalo e antecedência, veículo disponível no período, filial, entrega, km, combustível, motoristas, proteções e snapshot de preço são validados pelo backend. `GET /locacoes/checklist` retorna os itens ativos; respostas obrigatórias são validadas e congeladas como JSON na vistoria. Ocorrências adicionais podem ser registradas por ADMIN após a devolução e antes da finalização; criam saldo pendente e entram no valor final, sem captura de pagamento. A assinatura física pode ser registrada uma única vez por ADMIN, com data, sobre o texto de contrato congelado; não há assinatura digital. Idade, tempo de CNH e documentos são armazenados como política, mas ainda não podem ser verificados até que esses dados comprováveis integrem o cadastro do Cliente. Horários padrão são configuráveis, mas a data/hora efetiva continua sendo informada na reserva/vistoria.

## Motor de precificação

A página `/precificacao` é restrita a ADMIN. Custos ausentes permanecem incompletos (não são substituídos por zero): depreciação usa compra, revenda e vida útil do veículo; os demais dados incluem capital, tributos anuais, manutenção por km e parâmetros gerais de ocupação, margem, estrutura, quilometragem, limpeza e comissão. A tela mostra a diária mínima recomendada calculada pela API.

O ADMIN configura tarifas por categoria e vigência e pode aplicar pisos. A cotação calcula diárias com `ceil(duração / 24h)`, escolhe entre diária e pacotes semanais/mensais, aplica regras elegíveis por prioridade, adiciona serviços/proteções, aplica cupons e descontos de fidelidade apenas sobre diárias e limita o desconto máximo para preservar o custo mínimo e o piso; a resposta sinaliza quando esse limite reduz um desconto. Em seguida calcula ISS/taxas de pagamento. Caução é exibida separadamente, nunca somada ao preço. O cliente envia escolhas e quantidades, nunca um total confiável.

Ao criar uma locação, o serviço recalcula a cotação dentro da transação e salva `Locacao.valorTotal`, a discriminação, as regras aplicadas e a caução vigente em `LocacaoPreco`; a caução é um dado de garantia separado, não compõe o total. O eventual uso de cupom é contabilizado na mesma transação. Consultas históricas leem o snapshot, não a tarifa atual. Tarifas, regras, adicionais, proteções, cupons e níveis são preservados por inativação; alterações administrativas deixam registros de auditoria. `GET /precificacao/opcoes/:veiculoId` retorna apenas taxas necessárias à apresentação de serviços opcionais, não a configuração interna de custos.

Não há integração com gateway de pagamento: forma de pagamento e parcelamento afetam a estimativa das taxas configuradas, mas não cobram, autorizam ou capturam pagamentos. Caução e saldos começam pendentes; ações operacionais não simulam liquidação. Km excedente, atraso e combustível são calculados após registrar a vistoria de devolução. Ao registrar uma multa, a API procura a locação do veículo cujo período real (ou previsto, se ainda não houver datas reais) cobre a infração. Em caso de sobreposição, o ADMIN seleciona a locação; vínculo a outro veículo ou data fora do período é recusado. A cobrança pendente soma o valor da infração e a taxa administrativa configurada. O vínculo único entre multa e cobrança impede duplicação, e uma multa lançada após a finalização acrescenta o valor final sem alterar o snapshot original de preço.

## Testes

Na pasta `backend/`, execute `npm test` para rodar os testes unitários/HTTP com Prisma simulado, incluindo validação do catálogo, restrição ADMIN/USER e proteção de campos confidenciais. O cenário de ponta a ponta em `test/api.mysql.integration.test.js` é opt-in: requer um MySQL acessível em `DATABASE_URL`, `JWT_SECRET` com pelo menos 32 caracteres, migrations aplicadas e `RUN_MYSQL_INTEGRATION=true`. O CI configura um MySQL 8 temporário, aplica as migrations e executa esse cenário contra o banco real.

### Exemplos
```
POST /auth/login
{ "email": "demo@locadora.com", "senha": "123456" }

POST /precificacao/cotacao
{ "veiculoId": 1, "dataInicio": "2026-11-10T10:00:00.000Z", "dataPrevistaDevolucao": "2026-11-12T10:00:00.000Z", "adicionais": [], "protecoes": [], "formaPagamento": "pix" }

POST /locacoes
{ "veiculoId": 1, "dataInicio": "2026-11-10T10:00:00.000Z", "dataPrevistaDevolucao": "2026-11-12T10:00:00.000Z" }
```

`POST /locacoes` exige uma tarifa vigente e recalcula o preço na API. O resultado de `POST /precificacao/cotacao` é uma prévia; não envie `valorTotal`, pois o servidor ignora totais fornecidos pelo cliente.

### Códigos HTTP
| Código | Uso |
|---|---|
| 200 / 201 | Sucesso / criação |
| 400 | Validação de entrada |
| 401 | Token ausente ou inválido, credenciais inválidas |
| 403 | Acesso negado (por exemplo, locação de outro usuário ou rota ADMIN) |
| 404 | Veículo ou locação inexistente |
| 409 | Placa ou e-mail duplicado, veículo indisponível, locação já finalizada |
| 500 | Erro interno |

## Organização do código
```
prisma/       schema.prisma, migrations/, seed.js
src/routes/       mapeamento dos endpoints e middlewares
src/controllers/  entrada e resposta HTTP
src/services/     validações e regras de negócio, acesso ao Prisma (inclui cálculo em `precificacao.calculo.js`)
src/middlewares/  autenticação JWT e tratamento de erros
src/lib/          cliente Prisma e AppError
src/integrations/ adaptadores de integrações externas usados somente pelo backend (nenhum implementado atualmente)
```

## Decisões de projeto
- **Separação de responsabilidades:** as rotas só mapeiam endpoints, os controllers tratam a requisição e a resposta, e os services concentram as regras de negócio.
- **Identificação do usuário:** o `usuarioId` das locações vem sempre do token (`req.userId`), nunca do corpo da requisição.
- **Senhas:** guardadas com `bcrypt` (10 rounds). O hash nunca é retornado pela API, porque os `select` do service de autenticação omitem o campo.
- **Cálculo do valor:** realizado com Decimal no motor de precificação; o service de locações recalcula na confirmação e grava os componentes em `LocacaoPreco` na mesma transação.
- **Concorrência:** a reserva consulta locações abertas e usa `updateMany` condicionado a `status: 'disponivel'` dentro de `prisma.$transaction`; a segunda de duas reservas simultâneas recebe 409. As transições da locação também condicionam a atualização ao estado anterior esperado, e a retirada/devolução/cancelamento atualiza a frota condicionalmente.
- **Histórico:** locações e veículos não são excluídos fisicamente; veículos são inativados, e as FKs de histórico impedem remoção acidental dos registros.
- **Erros:** `AppError` carrega o código HTTP, e o middleware de erro devolve `{ "erro": "mensagem" }`.

## Modelo de dados
- `Usuario` 1:N `Locacao` (`Locacao.usuarioId`)
- `Veiculo` 1:N `Locacao` (`Locacao.veiculoId`)
- `CategoriaVeiculo` 1:N `Veiculo`; `Filial` 1:N `Veiculo`
- `Veiculo` N:N `OpcionalVeiculo` pela tabela `veiculo_opcionais`
- `Veiculo` 1:N `Manutencao`, `SinistroAvaria`, `Multa` e `Vistoria`
- `CategoriaVeiculo` 1:N `TarifaBase`, `RegraPreco`, `PrecoPisoCategoria`, `ProtecaoPreco` e `Promocao`
- `Veiculo` 1:1 `CustoPrecificacaoVeiculo`; `ConfiguracaoPrecificacao` mantém ocupação/margem e taxas globais
- `Locacao` 1:1 `LocacaoPreco`, com snapshot imutável; `Promocao` 1:N `UsoPromocao` e cada uso aponta a uma locação/usuário
- `Protecao` 1:N `ProtecaoPreco`; `Convenio` 1:N `Promocao`
- `LocacaoPreco.valorCaucao` preserva a garantia cotada na confirmação, separada de `valorTotal`
- E-mail e placa são únicos. `Locacao.status` usa `reservada`, `retirada`, `em_andamento`, `devolvida`, `finalizada` ou `cancelada`.
