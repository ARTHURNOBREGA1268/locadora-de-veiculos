const test = require('node:test');
const assert = require('node:assert/strict');

const habilitado = process.env.RUN_MYSQL_INTEGRATION === 'true';

test('fluxo completo da locadora com MySQL real', {
  skip: habilitado ? false : 'Defina RUN_MYSQL_INTEGRATION=true e DATABASE_URL para executar este teste.'
}, async t => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL é obrigatória para a integração MySQL');
  assert.ok(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32, 'JWT_SECRET de teste deve ter pelo menos 32 caracteres');

  const prisma = require('../src/lib/prisma');
  const app = require('../src/app');
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await prisma.$disconnect();
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const sufixo = `${Date.now()}-${process.pid}`;
  const credenciais1 = {
    nome: 'Pessoa de Integração',
    email: `integracao-${sufixo}@example.test`,
    senha: 'senha-segura-123'
  };
  const credenciais2 = {
    nome: 'Outra Pessoa',
    email: `outro-${sufixo}@example.test`,
    senha: 'senha-segura-456'
  };

  async function requisitar(caminho, { metodo = 'GET', token, corpo } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (corpo !== undefined) headers['Content-Type'] = 'application/json';
    const resposta = await fetch(`${baseUrl}${caminho}`, {
      method: metodo,
      headers,
      body: corpo === undefined ? undefined : JSON.stringify(corpo)
    });
    const dados = await resposta.json();
    return { status: resposta.status, dados };
  }

  const registro1 = await requisitar('/auth/register', { metodo: 'POST', corpo: credenciais1 });
  assert.equal(registro1.status, 201);
  assert.equal(registro1.dados.email, credenciais1.email);
  assert.equal(Object.hasOwn(registro1.dados, 'senhaHash'), false);

  const login1 = await requisitar('/auth/login', {
    metodo: 'POST',
    corpo: { email: credenciais1.email, senha: credenciais1.senha }
  });
  assert.equal(login1.status, 200);
  assert.ok(login1.dados.token);
  const token1 = login1.dados.token;

  const perfil = await requisitar('/auth/me', { token: token1 });
  assert.equal(perfil.status, 200);
  assert.equal(perfil.dados.id, registro1.dados.id);

  const semAutenticacao = await requisitar('/veiculos');
  assert.equal(semAutenticacao.status, 401);

  const placa = `CI${String(Date.now()).slice(-6)}A`;
  const dadosVeiculo = {
    marca: 'Toyota',
    modelo: 'Veículo de integração',
    placa: placa.toLowerCase(),
    ano: 2024,
    valorDiaria: 120.55
  };
  const cadastroVeiculo = await requisitar('/veiculos', {
    metodo: 'POST',
    token: token1,
    corpo: dadosVeiculo
  });
  assert.equal(cadastroVeiculo.status, 201);
  assert.equal(cadastroVeiculo.dados.placa, placa);
  assert.equal(cadastroVeiculo.dados.disponivel, true);

  const placaDuplicada = await requisitar('/veiculos', {
    metodo: 'POST',
    token: token1,
    corpo: dadosVeiculo
  });
  assert.equal(placaDuplicada.status, 409);

  const inicio = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const devolucao = new Date(inicio.getTime() + 25 * 60 * 60 * 1000);
  const dadosLocacao = {
    veiculoId: cadastroVeiculo.dados.id,
    dataInicio: inicio.toISOString(),
    dataPrevistaDevolucao: devolucao.toISOString()
  };
  const cadastroLocacao = await requisitar('/locacoes', {
    metodo: 'POST',
    token: token1,
    corpo: dadosLocacao
  });
  assert.equal(cadastroLocacao.status, 201);
  assert.equal(cadastroLocacao.dados.status, 'ATIVA');
  assert.equal(Number(cadastroLocacao.dados.valorTotal), 241.1);

  const veiculosDisponiveis = await requisitar('/veiculos?disponivel=true', { token: token1 });
  assert.equal(veiculosDisponiveis.status, 200);
  assert.equal(veiculosDisponiveis.dados.some(item => item.id === cadastroVeiculo.dados.id), false);

  const locacaoDuplicada = await requisitar('/locacoes', {
    metodo: 'POST',
    token: token1,
    corpo: dadosLocacao
  });
  assert.equal(locacaoDuplicada.status, 409);

  const registro2 = await requisitar('/auth/register', { metodo: 'POST', corpo: credenciais2 });
  assert.equal(registro2.status, 201);
  const login2 = await requisitar('/auth/login', {
    metodo: 'POST',
    corpo: { email: credenciais2.email, senha: credenciais2.senha }
  });
  assert.equal(login2.status, 200);
  const token2 = login2.dados.token;

  const consultaAlheia = await requisitar(`/locacoes/${cadastroLocacao.dados.id}`, { token: token2 });
  assert.equal(consultaAlheia.status, 403);
  const finalizacaoAlheia = await requisitar(`/locacoes/${cadastroLocacao.dados.id}/finalizar`, {
    metodo: 'PATCH',
    token: token2
  });
  assert.equal(finalizacaoAlheia.status, 403);

  const historicoAntes = await requisitar('/locacoes', { token: token1 });
  assert.equal(historicoAntes.status, 200);
  assert.equal(historicoAntes.dados.length, 1);

  const finalizacao = await requisitar(`/locacoes/${cadastroLocacao.dados.id}/finalizar`, {
    metodo: 'PATCH',
    token: token1
  });
  assert.equal(finalizacao.status, 200);
  assert.equal(finalizacao.dados.status, 'FINALIZADA');
  assert.ok(finalizacao.dados.dataDevolucaoEfetiva);
  assert.equal(finalizacao.dados.veiculo.disponivel, true);

  const finalizacaoRepetida = await requisitar(`/locacoes/${cadastroLocacao.dados.id}/finalizar`, {
    metodo: 'PATCH',
    token: token1
  });
  assert.equal(finalizacaoRepetida.status, 409);

  const historicoDepois = await requisitar('/locacoes', { token: token1 });
  assert.equal(historicoDepois.status, 200);
  assert.equal(historicoDepois.dados.length, 1);
  assert.equal(historicoDepois.dados[0].status, 'FINALIZADA');

  const veiculosDisponiveisDepois = await requisitar('/veiculos?disponivel=true', { token: token1 });
  assert.equal(veiculosDisponiveisDepois.dados.some(item => item.id === cadastroVeiculo.dados.id), true);
});
