# Sistema de Locação de Veículos

Projeto full stack da atividade de Programação com Frameworks Web. A aplicação é dividida em uma API REST em Node.js/Express e uma interface React. O frontend consome a API; as regras de negócio e o acesso ao MySQL ficam no backend por meio do Prisma.

## Estrutura

```text
backend/   API REST, autenticação JWT, regras de negócio, Prisma e migrations
frontend/  Interface React/Vite e integração HTTP com a API
```

## Requisitos

- Node.js 18.11 ou superior e npm
- MySQL
- Uma instância de MySQL acessível pelo backend

## Obter o projeto

```bash
git clone https://github.com/projeto-dev-web-com-framework/locadora-de-veiculos.git
cd locadora-de-veiculos
```

## Configuração local

1. Configure o banco MySQL e crie um banco para a aplicação.
2. No backend, copie `.env.example` para `.env` e preencha `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT` e `CORS_ORIGIN` conforme seu ambiente. Gere um `JWT_SECRET` com pelo menos 32 caracteres usando `openssl rand -base64 32`. Não compartilhe nem versione o arquivo `.env`.
3. No frontend, copie `frontend/.env.example` para `frontend/.env` e defina `VITE_API_URL` para o endereço base da API (por exemplo, `http://localhost:3333`).

## Instalação e execução

Execute cada módulo em um terminal separado.

### Backend

```bash
cd backend
npm ci
npx prisma generate
npx prisma migrate deploy
npm run seed
npm run dev
```

### Frontend

```bash
cd frontend
npm ci
npm run dev
```

Consulte também `backend/README.md` e `frontend/README.md` para os detalhes específicos de cada módulo. Os comandos de banco devem ser executados somente contra o banco local/de desenvolvimento configurado pelo integrante.

## Integrantes

- A preencher com os nomes completos antes da entrega.

## Situação da consolidação

Este repositório reúne os códigos de backend e frontend para facilitar a entrega em um único local. Os repositórios-fonte `backend` e `frontend` foram mantidos separados e não são removidos por esta consolidação.
