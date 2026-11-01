# Locadora de Veículos — Backend

API REST do sistema de locação de veículos. O frontend React está no repositório `frontend`.

## Descrição
Uma locadora cadastra veículos, controla a disponibilidade e registra as locações feitas por usuários autenticados. O sistema calcula o valor das locações, preserva o histórico e impede duas locações ativas para o mesmo veículo.

## Funcionalidades
- Cadastro e login de usuários, com senha em hash (bcrypt) e autenticação por JWT
- Cadastro e listagem de veículos, com filtro de disponíveis
- Registro de locação com cálculo do valor no backend (qualquer fração de 24 horas conta como diária completa)
- Listagem das locações do usuário autenticado, com os dados do veículo
- Finalização de locação, que registra a devolução e libera o veículo
- Acesso restrito ao dono da locação

## Integrantes
- Nome completo
- Nome completo

## Tecnologias
Node.js, Express, Prisma ORM, MySQL, JWT, bcrypt, React (repositório `frontend`)

## Requisitos
- Node.js 18 ou superior
- MySQL 8 ou superior, com um usuário que possa criar bancos (o `prisma migrate dev` usa um banco temporário)

## Instalação e execução

### Backend
1. `git clone https://github.com/projeto-dev-web-com-framework/backend.git`
2. `cd backend`
3. `npm install`
4. Criar o banco: `CREATE DATABASE locadora CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
5. Copiar `.env.example` para `.env` e preencher:

| Variável | Descrição | Exemplo |
|---|---|---|
| DATABASE_URL | Conexão com o MySQL | `mysql://usuario:senha@localhost:3306/locadora` |
| JWT_SECRET | Segredo para assinar tokens | texto longo e aleatório |
| JWT_EXPIRES_IN | Validade do token | `1d` |
| PORT | Porta da API | `3333` |
| CORS_ORIGIN | Origem do frontend | `http://localhost:5173` |

Caracteres especiais na senha do banco devem ser codificados na URL (`@` vira `%40`).

6. `npx prisma migrate dev` (aplica as migrations versionadas em `prisma/migrations`)
7. `npx prisma db seed` (cria o usuário de exemplo e 4 veículos)
8. `npm run dev` (a API sobe em `http://localhost:3333`)

### Frontend
1. `git clone https://github.com/projeto-dev-web-com-framework/frontend.git`
2. `cd frontend`
3. `npm install`
4. Copiar `.env.example` para `.env` e preencher `VITE_API_URL` com a URL da API (ex.: `http://localhost:3333`)
5. `npm run dev` e acessar `http://localhost:5173`

## Dados de exemplo
Usuário: `demo@locadora.com` / senha `123456`
Veículos do seed: Fiat Mobi, Chevrolet Onix, Volkswagen T-Cross e Toyota Corolla.

## Rotas
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | /auth/register | não | Cadastra usuário |
| POST | /auth/login | não | Retorna o JWT |
| GET | /auth/me | sim | Dados do usuário autenticado |
| POST | /veiculos | sim | Cadastra veículo |
| GET | /veiculos | sim | Lista veículos |
| GET | /veiculos?disponivel=true | sim | Lista só os disponíveis |
| POST | /locacoes | sim | Registra locação |
| GET | /locacoes | sim | Lista as locações do usuário |
| GET | /locacoes/:id | sim | Consulta uma locação do usuário |
| PATCH | /locacoes/:id/finalizar | sim | Finaliza a locação |

Rotas protegidas exigem o header `Authorization: Bearer <token>`.

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
| 403 | Locação de outro usuário |
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
```

## Decisões de projeto
- **Separação de responsabilidades:** as rotas só mapeiam endpoints, os controllers tratam a requisição e a resposta, e os services concentram as regras de negócio.
- **Identificação do usuário:** o `usuarioId` das locações vem sempre do token (`req.userId`), nunca do corpo da requisição.
- **Senhas:** guardadas com `bcrypt` (10 rounds). O hash nunca é retornado pela API, porque os `select` do service de autenticação omitem o campo.
- **Cálculo do valor:** feito no service de locações. Número de diárias é `ceil(duração / 24h)`, multiplicado pela diária do veículo.
- **Concorrência:** a reserva usa `updateMany` condicionado a `disponivel: true` dentro de `prisma.$transaction`. O banco garante que só uma de duas requisições simultâneas altere a disponibilidade. A segunda recebe 409. A finalização usa a mesma técnica com `status: 'ATIVA'`.
- **Histórico:** locações e veículos não são excluídos.
- **Erros:** `AppError` carrega o código HTTP, e o middleware de erro devolve `{ "erro": "mensagem" }`.

## Modelo de dados
- `Usuario` 1:N `Locacao` (`Locacao.usuarioId`)
- `Veiculo` 1:N `Locacao` (`Locacao.veiculoId`)
- E-mail e placa são únicos. `Locacao.status` é `ATIVA` ou `FINALIZADA`.
