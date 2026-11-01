# Locadora de Veículos — Frontend

Interface React do sistema de locação de veículos. Consome a API REST do repositório `backend`.

## Funcionalidades
- Cadastro, login e logout, com identificação do usuário autenticado
- Veículos: cadastro, listagem e filtro de disponibilidade (todos, disponíveis, alugados)
- Locações: escolha de veículo disponível, definição das datas, registro, histórico, valor total e finalização
- Mensagens de sucesso e erro vindas da API
- Sessão verificada no backend (`GET /auth/me`); token inválido ou expirado devolve o usuário ao login

## Integrantes
- Nome completo
- Nome completo

## Requisitos
- Node.js 18 ou superior
- Backend em execução (ver repositório `backend`)

## Instalação
1. `npm install`
2. Copiar `.env.example` para `.env` e preencher `VITE_API_URL` com a URL da API (ex.: `http://localhost:3333`). Se ficar vazio, usa `http://localhost:3333`.
3. `npm run dev`
4. Acessar `http://localhost:5173`

O backend deve ter `CORS_ORIGIN` igual a `http://localhost:5173`.

## Usuário de exemplo
`demo@locadora.com` / `123456` (criado pelo seed do backend)

## Estrutura
```
src/
  components/   Alert, Navbar, Layout, ProtectedRoute, PlateBadge, VeiculoForm, VeiculoList, LocacaoForm, LocacaoList
  context/      AuthContext (estado de autenticação)
  pages/        Login, Cadastro, Veiculos, Locacoes
  services/     api (axios + interceptors), authService, veiculoService, locacaoService
  utils/        format (moeda e datas)
```

## Decisões
- Token JWT guardado em `localStorage` e enviado em `Authorization: Bearer <token>` por um interceptor do axios.
- O valor total da locação é calculado no backend; a interface apenas exibe o valor retornado.
- Formulários controlados com `useState`; após cada operação as listas são recarregadas a partir da API.
