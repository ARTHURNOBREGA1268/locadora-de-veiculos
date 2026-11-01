# Locadora de Veículos — Backend

API REST e núcleo das regras de negócio do sistema de locação de veículos. No repositório consolidado, a interface React fica na pasta irmã `../frontend`; o MySQL é acessado somente pelo backend. A API escuta em loopback por padrão e o frontend a acessa pelo proxy `/api`.

## Descrição
Uma locadora cadastra veículos, controla a disponibilidade e registra as locações feitas por usuários autenticados. O sistema calcula o valor das locações, preserva o histórico e impede duas locações ativas para o mesmo veículo.

## Funcionalidades
- Cadastro e login de usuários, com senha em hash (bcrypt) e autenticação por JWT
- Papéis USER e ADMIN; usuários públicos são sempre USER
- Gestão administrativa de usuários (listar, criar, editar, atribuir USER/ADMIN e ativar/inativar), além do cadastro de veículos restritos a ADMIN
- Catálogo administrativo de veículos: cadastro/edição de identificação, características, situação operacional, dados financeiros/documentais, categoria, filial e opcionais
- Listagem pública com campos seguros e filtros por status; detalhe completo e histórico somente para ADMIN
- Histórico administrativo por veículo: manutenções, sinistros/avarias, multas e vistorias; vínculos de locação são validados
- Registro de locação com cálculo do valor no backend (qualquer fração de 24 horas conta como diária completa)
- Listagem das locações do usuário autenticado, com os dados do veículo
- Finalização de locação, que registra a devolução e libera o veículo
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
| GET | /usuarios | sim, ADMIN | Lista usuários ativos e inativos sem senhaHash |
| POST | /usuarios | sim, ADMIN | Cadastra usuário (nome, email, senha; papel USER/ADMIN opcional) |
| PATCH | /usuarios/:id | sim, ADMIN | Edita nome/e-mail, redefine senha, troca papel ou ativa/inativa usuário |
| POST | /veiculos | sim, ADMIN | Cadastra veículo |
| GET | /veiculos/metadados | sim | Lista categorias, filiais e opcionais para formulários |
| GET | /veiculos | sim | Lista veículos |
| GET | /veiculos?disponivel=true | sim | Lista só os disponíveis |
| GET | /veiculos/:id | sim, ADMIN | Consulta cadastro completo do veículo |
| PATCH | /veiculos/:id | sim, ADMIN | Edita o cadastro sem alterar a tarifa diária |
| GET | /veiculos/:id/historico | sim, ADMIN | Lista manutenções, sinistros, multas e vistorias |
| POST | /veiculos/:id/manutencoes | sim, ADMIN | Registra manutenção |
| POST | /veiculos/:id/sinistros | sim, ADMIN | Registra sinistro/avaria |
| POST | /veiculos/:id/multas | sim, ADMIN | Registra multa e, opcionalmente, vincula locação do mesmo veículo |
| POST | /veiculos/:id/vistorias | sim, ADMIN | Registra vistoria de saída/entrada |
| POST | /locacoes | sim | Registra locação |
| GET | /locacoes | sim | Lista as locações do usuário |
| GET | /locacoes/:id | sim | Consulta uma locação do usuário |
| PATCH | /locacoes/:id/finalizar | sim | Finaliza a locação |

Rotas protegidas exigem o header `Authorization: Bearer <token>`. A cada requisição protegida, status, papel e versão de sessão são consultados no banco. Contas inativas são bloqueadas imediatamente; redefinir senha ou inativar incrementa a versão e revoga tokens existentes, inclusive se a conta for reativada depois. O papel de autorização vem do banco, nunca do cliente/JWT. Não há exclusão física: inativar preserva histórico. Administradores não podem inativar/rebaixar a si mesmos nem remover o último ADMIN ativo; conflitos retornam 409. Cadastro público cria sempre USER ativo e ignora papel/status enviados pelo cliente.

## Testes

Na pasta `backend/`, execute `npm test` para rodar os testes unitários/HTTP com Prisma simulado, incluindo validação do catálogo, restrição ADMIN/USER e proteção de campos confidenciais. O cenário de ponta a ponta em `test/api.mysql.integration.test.js` é opt-in: requer um MySQL acessível em `DATABASE_URL`, `JWT_SECRET` com pelo menos 32 caracteres, migrations aplicadas e `RUN_MYSQL_INTEGRATION=true`. O CI configura um MySQL 8 temporário, aplica as migrations e executa esse cenário contra o banco real.

### Exemplos
```
POST /auth/login
{ "email": "demo@locadora.com", "senha": "123456" }

POST /locacoes
{ "veiculoId": 1, "dataInicio": "2026-11-10T10:00:00.000Z", "dataPrevistaDevolucao": "2026-11-12T10:00:00.000Z" }
```

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
src/services/     validações e regras de negócio, acesso ao Prisma
src/middlewares/  autenticação JWT e tratamento de erros
src/lib/          cliente Prisma e AppError
src/integrations/ adaptadores de integrações externas usados somente pelo backend (nenhum implementado atualmente)
```

## Decisões de projeto
- **Separação de responsabilidades:** as rotas só mapeiam endpoints, os controllers tratam a requisição e a resposta, e os services concentram as regras de negócio.
- **Identificação do usuário:** o `usuarioId` das locações vem sempre do token (`req.userId`), nunca do corpo da requisição.
- **Senhas:** guardadas com `bcrypt` (10 rounds). O hash nunca é retornado pela API, porque os `select` do service de autenticação omitem o campo.
- **Cálculo do valor:** feito no service de locações. Número de diárias é `ceil(duração / 24h)`, multiplicado pela diária do veículo.
- **Concorrência:** a reserva usa `updateMany` condicionado a `status: 'disponivel'` dentro de `prisma.$transaction`. O banco garante que só uma de duas requisições simultâneas altere o status. A segunda recebe 409. A finalização usa a mesma técnica com `status: 'ATIVA'`.
- **Histórico:** locações e veículos não são excluídos fisicamente; veículos são inativados, e as FKs de histórico impedem remoção acidental dos registros.
- **Erros:** `AppError` carrega o código HTTP, e o middleware de erro devolve `{ "erro": "mensagem" }`.

## Modelo de dados
- `Usuario` 1:N `Locacao` (`Locacao.usuarioId`)
- `Veiculo` 1:N `Locacao` (`Locacao.veiculoId`)
- `CategoriaVeiculo` 1:N `Veiculo`; `Filial` 1:N `Veiculo`
- `Veiculo` N:N `OpcionalVeiculo` pela tabela `veiculo_opcionais`
- `Veiculo` 1:N `Manutencao`, `SinistroAvaria`, `Multa` e `Vistoria`
- E-mail e placa são únicos. `Locacao.status` é `ATIVA` ou `FINALIZADA`.
