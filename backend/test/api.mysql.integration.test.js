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
    senha: 'senha-segura-123',
    papel: 'ADMIN'
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
  assert.equal(registro1.dados.papel, 'USER');
  assert.equal(Object.hasOwn(registro1.dados, 'senhaHash'), false);

  const login1 = await requisitar('/auth/login', {
    metodo: 'POST',
    corpo: { email: credenciais1.email, senha: credenciais1.senha }
  });
  assert.equal(login1.status, 200);
  assert.ok(login1.dados.token);
  assert.equal(login1.dados.usuario.papel, 'USER');
  assert.equal(Object.hasOwn(login1.dados.usuario, 'senhaHash'), false);
  const token1 = login1.dados.token;

  const perfil = await requisitar('/auth/me', { token: token1 });
  assert.equal(perfil.status, 200);
  assert.equal(perfil.dados.id, registro1.dados.id);
  assert.equal(perfil.dados.papel, 'USER');
  await prisma.usuario.update({ where: { id: registro1.dados.id }, data: { papel: 'ADMIN' } });

  const semAutenticacao = await requisitar('/veiculos');
  assert.equal(semAutenticacao.status, 401);

  const usuariosAdmin = await requisitar('/usuarios', { token: token1 });
  assert.equal(usuariosAdmin.status, 200);
  assert.equal(usuariosAdmin.dados.some(usuario => Object.hasOwn(usuario, 'senhaHash')), false);

  const usuarioGerenciado = await requisitar('/usuarios', {
    metodo: 'POST', token: token1,
    corpo: { nome: 'Conta Gerenciada', email: `gerenciada-${sufixo}@example.test`, senha: 'senha-inicial-forte', papel: 'ADMIN' }
  });
  assert.equal(usuarioGerenciado.status, 201);
  assert.equal(usuarioGerenciado.dados.papel, 'ADMIN');
  assert.equal(usuarioGerenciado.dados.ativo, true);
  assert.equal(Object.hasOwn(usuarioGerenciado.dados, 'senhaHash'), false);
  const edicaoGerenciada = await requisitar(`/usuarios/${usuarioGerenciado.dados.id}`, {
    metodo: 'PATCH', token: token1, corpo: { nome: 'Conta Gerenciada Atualizada' }
  });
  assert.equal(edicaoGerenciada.status, 200);
  assert.equal(edicaoGerenciada.dados.nome, 'Conta Gerenciada Atualizada');
  const loginGerenciado = await requisitar('/auth/login', {
    metodo: 'POST', corpo: { email: usuarioGerenciado.dados.email, senha: 'senha-inicial-forte' }
  });
  assert.equal(loginGerenciado.status, 200);
  const alteracoesConcorrentes = await Promise.all([
    requisitar(`/usuarios/${usuarioGerenciado.dados.id}`, {
      metodo: 'PATCH', token: token1, corpo: { papel: 'USER' }
    }),
    requisitar(`/usuarios/${registro1.dados.id}`, {
      metodo: 'PATCH', token: loginGerenciado.dados.token, corpo: { papel: 'USER' }
    })
  ]);
  assert.ok(alteracoesConcorrentes.every(resultado => [200, 403, 409].includes(resultado.status)));
  const adminsDeTeste = await prisma.usuario.count({
    where: { id: { in: [registro1.dados.id, usuarioGerenciado.dados.id] }, papel: 'ADMIN', ativo: true }
  });
  assert.ok(adminsDeTeste >= 1, 'uma alteração concorrente nunca pode remover o último ADMIN ativo');
  await prisma.usuario.update({ where: { id: registro1.dados.id }, data: { papel: 'ADMIN' } });
  const redefinicaoSenha = await requisitar(`/usuarios/${usuarioGerenciado.dados.id}`, {
    metodo: 'PATCH', token: token1, corpo: { senha: 'senha-alterada-segura' }
  });
  assert.equal(redefinicaoSenha.status, 200);
  assert.equal((await requisitar('/auth/me', { token: loginGerenciado.dados.token })).status, 401);
  assert.equal((await requisitar('/auth/login', {
    metodo: 'POST', corpo: { email: usuarioGerenciado.dados.email, senha: 'senha-inicial-forte' }
  })).status, 401);
  const loginSenhaNova = await requisitar('/auth/login', {
    metodo: 'POST', corpo: { email: usuarioGerenciado.dados.email, senha: 'senha-alterada-segura' }
  });
  assert.equal(loginSenhaNova.status, 200);
  const trocaPapel = await requisitar(`/usuarios/${usuarioGerenciado.dados.id}`, {
    metodo: 'PATCH', token: token1, corpo: { papel: 'USER' }
  });
  assert.equal(trocaPapel.status, 200);
  assert.equal(trocaPapel.dados.papel, 'USER');
  const inativacao = await requisitar(`/usuarios/${usuarioGerenciado.dados.id}`, {
    metodo: 'PATCH', token: token1, corpo: { ativo: false }
  });
  assert.equal(inativacao.status, 200);
  assert.equal(inativacao.dados.ativo, false);
  assert.equal((await requisitar('/auth/me', { token: loginSenhaNova.dados.token })).status, 401);
  assert.equal((await requisitar('/auth/login', {
    metodo: 'POST', corpo: { email: usuarioGerenciado.dados.email, senha: 'senha-inicial-forte' }
  })).status, 401);
  const reativacao = await requisitar(`/usuarios/${usuarioGerenciado.dados.id}`, {
    metodo: 'PATCH', token: token1, corpo: { ativo: true }
  });
  assert.equal(reativacao.status, 200);
  assert.equal(reativacao.dados.ativo, true);
  assert.equal((await requisitar('/auth/me', { token: loginSenhaNova.dados.token })).status, 401);
  const novoLoginGerenciado = await requisitar('/auth/login', {
    metodo: 'POST', corpo: { email: usuarioGerenciado.dados.email, senha: 'senha-alterada-segura' }
  });
  assert.equal(novoLoginGerenciado.status, 200);
  assert.equal((await requisitar('/auth/me', { token: novoLoginGerenciado.dados.token })).status, 200);

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
