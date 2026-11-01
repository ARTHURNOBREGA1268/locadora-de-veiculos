const test = require("node:test");
const assert = require("node:assert/strict");

const habilitado = process.env.RUN_MYSQL_INTEGRATION === "true";

test(
  "fluxo completo da locadora com MySQL real",
  {
    skip: habilitado
      ? false
      : "Defina RUN_MYSQL_INTEGRATION=true e DATABASE_URL para executar este teste.",
  },
  async (t) => {
    assert.ok(
      process.env.DATABASE_URL,
      "DATABASE_URL é obrigatória para a integração MySQL",
    );
    assert.ok(
      process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32,
      "JWT_SECRET de teste deve ter pelo menos 32 caracteres",
    );

    const prisma = require("../src/lib/prisma");
    const app = require("../src/app");
    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    t.after(async () => {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      await prisma.$disconnect();
    });

    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const sufixo = `${Date.now()}-${process.pid}`;
    const credenciais1 = {
      nome: "Pessoa de Integração",
      email: `integracao-${sufixo}@example.test`,
      senha: "senha-segura-123",
      papel: "ADMIN",
    };
    const credenciais2 = {
      nome: "Outra Pessoa",
      email: `outro-${sufixo}@example.test`,
      senha: "senha-segura-456",
    };

    async function requisitar(caminho, { metodo = "GET", token, corpo } = {}) {
      const headers = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      if (corpo !== undefined) headers["Content-Type"] = "application/json";
      const resposta = await fetch(`${baseUrl}${caminho}`, {
        method: metodo,
        headers,
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
      });
      const dados = await resposta.json();
      return { status: resposta.status, dados };
    }

    const registro1 = await requisitar("/auth/register", {
      metodo: "POST",
      corpo: credenciais1,
    });
    assert.equal(registro1.status, 201);
    assert.equal(registro1.dados.email, credenciais1.email);
    assert.equal(registro1.dados.papel, "USER");
    assert.equal(Object.hasOwn(registro1.dados, "senhaHash"), false);

    const login1 = await requisitar("/auth/login", {
      metodo: "POST",
      corpo: { email: credenciais1.email, senha: credenciais1.senha },
    });
    assert.equal(login1.status, 200);
    assert.ok(login1.dados.token);
    assert.equal(login1.dados.usuario.papel, "USER");
    assert.equal(Object.hasOwn(login1.dados.usuario, "senhaHash"), false);
    const token1 = login1.dados.token;

    const perfil = await requisitar("/auth/me", { token: token1 });
    assert.equal(perfil.status, 200);
    assert.equal(perfil.dados.id, registro1.dados.id);
    assert.equal(perfil.dados.papel, "USER");
    await prisma.usuario.update({
      where: { id: registro1.dados.id },
      data: { papel: "ADMIN" },
    });

    const semAutenticacao = await requisitar("/veiculos");
    assert.equal(semAutenticacao.status, 401);

    assert.equal((await requisitar('/configuracoes/locacao', { token: token1 })).status, 200);
    const usuariosAdmin = await requisitar("/usuarios", { token: token1 });
    assert.equal(usuariosAdmin.status, 200);
    assert.equal(
      usuariosAdmin.dados.some((usuario) =>
        Object.hasOwn(usuario, "senhaHash"),
      ),
      false,
    );

    const usuarioGerenciado = await requisitar("/usuarios", {
      metodo: "POST",
      token: token1,
      corpo: {
        nome: "Conta Gerenciada",
        email: `gerenciada-${sufixo}@example.test`,
        senha: "senha-inicial-forte",
        papel: "ADMIN",
      },
    });
    assert.equal(usuarioGerenciado.status, 201);
    assert.equal(usuarioGerenciado.dados.papel, "ADMIN");
    assert.equal(usuarioGerenciado.dados.ativo, true);
    assert.equal(Object.hasOwn(usuarioGerenciado.dados, "senhaHash"), false);
    const edicaoGerenciada = await requisitar(
      `/usuarios/${usuarioGerenciado.dados.id}`,
      {
        metodo: "PATCH",
        token: token1,
        corpo: { nome: "Conta Gerenciada Atualizada" },
      },
    );
    assert.equal(edicaoGerenciada.status, 200);
    assert.equal(edicaoGerenciada.dados.nome, "Conta Gerenciada Atualizada");
    const loginGerenciado = await requisitar("/auth/login", {
      metodo: "POST",
      corpo: {
        email: usuarioGerenciado.dados.email,
        senha: "senha-inicial-forte",
      },
    });
    assert.equal(loginGerenciado.status, 200);
    const alteracoesConcorrentes = await Promise.all([
      requisitar(`/usuarios/${usuarioGerenciado.dados.id}`, {
        metodo: "PATCH",
        token: token1,
        corpo: { papel: "USER" },
      }),
      requisitar(`/usuarios/${registro1.dados.id}`, {
        metodo: "PATCH",
        token: loginGerenciado.dados.token,
        corpo: { papel: "USER" },
      }),
    ]);
    assert.ok(
      alteracoesConcorrentes.every((resultado) =>
        [200, 403, 409].includes(resultado.status),
      ),
    );
    const adminsDeTeste = await prisma.usuario.count({
      where: {
        id: { in: [registro1.dados.id, usuarioGerenciado.dados.id] },
        papel: "ADMIN",
        ativo: true,
      },
    });
    assert.ok(
      adminsDeTeste >= 1,
      "uma alteração concorrente nunca pode remover o último ADMIN ativo",
    );
    await prisma.usuario.update({
      where: { id: registro1.dados.id },
      data: { papel: "ADMIN" },
    });
    const redefinicaoSenha = await requisitar(
      `/usuarios/${usuarioGerenciado.dados.id}`,
      {
        metodo: "PATCH",
        token: token1,
        corpo: { senha: "senha-alterada-segura" },
      },
    );
    assert.equal(redefinicaoSenha.status, 200);
    assert.equal(
      (await requisitar("/auth/me", { token: loginGerenciado.dados.token }))
        .status,
      401,
    );
    assert.equal(
      (
        await requisitar("/auth/login", {
          metodo: "POST",
          corpo: {
            email: usuarioGerenciado.dados.email,
            senha: "senha-inicial-forte",
          },
        })
      ).status,
      401,
    );
    const loginSenhaNova = await requisitar("/auth/login", {
      metodo: "POST",
      corpo: {
        email: usuarioGerenciado.dados.email,
        senha: "senha-alterada-segura",
      },
    });
    assert.equal(loginSenhaNova.status, 200);
    const trocaPapel = await requisitar(
      `/usuarios/${usuarioGerenciado.dados.id}`,
      {
        metodo: "PATCH",
        token: token1,
        corpo: { papel: "USER" },
      },
    );
    assert.equal(trocaPapel.status, 200);
    assert.equal(trocaPapel.dados.papel, "USER");
    const inativacao = await requisitar(
      `/usuarios/${usuarioGerenciado.dados.id}`,
      {
        metodo: "PATCH",
        token: token1,
        corpo: { ativo: false },
      },
    );
    assert.equal(inativacao.status, 200);
    assert.equal(inativacao.dados.ativo, false);
    assert.equal(
      (await requisitar("/auth/me", { token: loginSenhaNova.dados.token }))
        .status,
      401,
    );
    assert.equal(
      (
        await requisitar("/auth/login", {
          metodo: "POST",
          corpo: {
            email: usuarioGerenciado.dados.email,
            senha: "senha-inicial-forte",
          },
        })
      ).status,
      401,
    );
    const reativacao = await requisitar(
      `/usuarios/${usuarioGerenciado.dados.id}`,
      {
        metodo: "PATCH",
        token: token1,
        corpo: { ativo: true },
      },
    );
    assert.equal(reativacao.status, 200);
    assert.equal(reativacao.dados.ativo, true);
    assert.equal(
      (await requisitar("/auth/me", { token: loginSenhaNova.dados.token }))
        .status,
      401,
    );
    const novoLoginGerenciado = await requisitar("/auth/login", {
      metodo: "POST",
      corpo: {
        email: usuarioGerenciado.dados.email,
        senha: "senha-alterada-segura",
      },
    });
    assert.equal(novoLoginGerenciado.status, 200);
    assert.equal(
      (await requisitar("/auth/me", { token: novoLoginGerenciado.dados.token }))
        .status,
      200,
    );

    const metadadosVeiculos = await requisitar("/veiculos/metadados", {
      token: token1,
    });
    assert.equal(metadadosVeiculos.status, 200);
    const categoria = metadadosVeiculos.dados.categorias.find(
      (item) => item.nome === "Econômico",
    );
    const filial = metadadosVeiculos.dados.filiais.find(
      (item) => item.nome === "Matriz",
    );
    const opcional = metadadosVeiculos.dados.opcionais[0];
    assert.ok(
      categoria && filial && opcional,
      "migration deve semear categorias, filial e opcionais",
    );

    const configuracaoInicial = await requisitar("/configuracoes/locacao", {
      token: token1,
    });
    assert.equal(configuracaoInicial.status, 200);
    const configuracaoPayload = { ...configuracaoInicial.dados };
    delete configuracaoPayload.catalogos;
    delete configuracaoPayload.id;
    delete configuracaoPayload.createdAt;
    delete configuracaoPayload.updatedAt;
    const nomeProtecaoTeste = `Proteção CI ${sufixo}`;
    const descricaoChecklistTeste = `Checklist CI ${sufixo}`;
    configuracaoPayload.filiaisRetirada = [filial.id];
    configuracaoPayload.filiaisDevolucao = [filial.id];
    configuracaoPayload.protecoes = [
      ...configuracaoPayload.protecoes,
      {
        nome: nomeProtecaoTeste,
        descricao: "Proteção criada pelo teste de integração",
        ativo: true,
        selecionada: true,
      },
    ];
    configuracaoPayload.franquiasCategoria = [
      { categoriaId: categoria.id, valor: 1234.56 },
    ];
    configuracaoPayload.caucoesCategoria = [
      { categoriaId: categoria.id, valor: 2345.67 },
    ];
    configuracaoPayload.checklistItens = [
      ...configuracaoPayload.checklistItens,
      {
        descricao: descricaoChecklistTeste,
        obrigatorio: true,
        ativo: true,
        ordem: configuracaoPayload.checklistItens.length,
      },
    ];
    const configuracaoSalva = await requisitar("/configuracoes/locacao", {
      metodo: "PUT",
      token: token1,
      corpo: configuracaoPayload,
    });
    assert.equal(configuracaoSalva.status, 200);
    assert.ok(
      configuracaoSalva.dados.protecoes.some(
        (protecao) =>
          protecao.nome === nomeProtecaoTeste && protecao.selecionada,
      ),
      "proteção nova e seleção devem persistir",
    );
    assert.ok(
      configuracaoSalva.dados.checklistItens.some(
        (item) => item.descricao === descricaoChecklistTeste,
      ),
      "item de checklist novo deve persistir",
    );
    assert.equal(
      Number(configuracaoSalva.dados.franquiasCategoria[0].valor),
      1234.56,
    );
    assert.equal(
      Number(configuracaoSalva.dados.caucoesCategoria[0].valor),
      2345.67,
    );

    const placa = `CI${String(Date.now()).slice(-5)}A`;
    const renavam = String(Date.now()).slice(-11);
    const chassi = `9BWZZZ37${String(Date.now()).slice(-9)}`;
    const dadosVeiculo = {
      marca: "Toyota",
      modelo: "Veículo de integração",
      placa: placa.toLowerCase(),
      renavam,
      chassi,
      versao: "1.8 Hybrid",
      anoFabricacao: 2024,
      anoModelo: 2024,
      cor: "prata",
      categoriaId: categoria.id,
      cambio: "automatico",
      combustivel: "hibrido",
      motor: "1.8L",
      numPortas: 4,
      numPassageiros: 5,
      capacidadePortaMalas: 470,
      opcionais: [opcional.id],
      dataCompra: "2024-01-15",
      valorCompra: 150000,
      formaAquisicao: "financiado",
      valorFipe: 160000,
      valorRevendaEstimado: 100000,
      vidaUtilMeses: 120,
      crlvVencimento: "2027-01-15",
      ipvaVencimento: "2027-02-15",
      licenciamentoVencimento: "2027-03-15",
      seguradora: "Seguradora CI",
      apoliceNumero: `AP-${sufixo}`.slice(0, 40),
      apoliceVencimento: "2027-04-15",
      apoliceFranquia: 5000,
      status: "disponivel",
      kmAtual: 50000,
      nivelCombustivel: 80,
      filialId: filial.id,
      proximaRevisaoKm: 60000,
      proximaRevisaoData: "2027-05-15",
      valorDiaria: 120.55,
    };
    const cadastroVeiculo = await requisitar("/veiculos", {
      metodo: "POST",
      token: token1,
      corpo: dadosVeiculo,
    });
    assert.equal(cadastroVeiculo.status, 201);
    assert.equal(cadastroVeiculo.dados.placa, placa);
    assert.equal(cadastroVeiculo.dados.renavam, renavam);
    assert.equal(cadastroVeiculo.dados.chassi, chassi);
    assert.equal(cadastroVeiculo.dados.opcionais[0].opcional.id, opcional.id);
    assert.equal(cadastroVeiculo.dados.status, "disponivel");

    const listaVeiculos = await requisitar("/veiculos", { token: token1 });
    const veiculoPublico = listaVeiculos.dados.find(
      (item) => item.id === cadastroVeiculo.dados.id,
    );
    assert.ok(veiculoPublico);
    for (const campo of [
      "placa",
      "renavam",
      "chassi",
      "valorCompra",
      "valorFipe",
      "apoliceNumero",
    ]) {
      assert.equal(
        Object.hasOwn(veiculoPublico, campo),
        false,
        `${campo} não deve aparecer na lista`,
      );
    }

    const detalheVeiculo = await requisitar(
      `/veiculos/${cadastroVeiculo.dados.id}`,
      { token: token1 },
    );
    assert.equal(detalheVeiculo.status, 200);
    assert.equal(Number(detalheVeiculo.dados.valorCompra), 150000);
    const edicaoVeiculo = await requisitar(
      `/veiculos/${cadastroVeiculo.dados.id}`,
      {
        metodo: "PATCH",
        token: token1,
        corpo: {
          versao: "1.8 Hybrid Premium",
          status: "disponivel",
          opcionais: [],
        },
      },
    );
    assert.equal(edicaoVeiculo.status, 200);
    assert.equal(edicaoVeiculo.dados.versao, "1.8 Hybrid Premium");
    assert.equal(edicaoVeiculo.dados.opcionais.length, 0);

    const precificacaoInicial = await requisitar("/precificacao/admin", { token: token1 });
    assert.equal(precificacaoInicial.status, 200);
    const parametrosPrecificacao = await requisitar("/precificacao/configuracao", {
      metodo: "PATCH",
      token: token1,
      corpo: {
        ocupacaoAlvoPercentual: 100,
        margemDesejadaPercentual: 0,
        custoAdministrativoMensal: 0,
        kmMedioDiario: 0,
        limpezaPorLocacao: 0,
        diasMediosLocacao: 1,
        comissaoPercentual: 0,
        taxaPagamentoPercentual: 0,
        issPercentual: 0,
      },
    });
    assert.equal(parametrosPrecificacao.status, 200);
    const custosVeiculo = await requisitar(
      `/precificacao/custos/${cadastroVeiculo.dados.id}`,
      {
        metodo: "PUT",
        token: token1,
        corpo: {
          custoCapitalMensal: 0,
          ipvaAnual: 0,
          seguroAnual: 0,
          licenciamentoAnual: 0,
          manutencaoPorKm: 0,
        },
      },
    );
    assert.equal(custosVeiculo.status, 200);
    const custoCapitalForaDoDecimal = await requisitar(`/precificacao/custos/${cadastroVeiculo.dados.id}`, {
      metodo: "PUT", token: token1, corpo: { custoCapitalMensal: 10000000000 },
    });
    assert.equal(custoCapitalForaDoDecimal.status, 400);
    const manutencaoForaDoDecimal = await requisitar(`/precificacao/custos/${cadastroVeiculo.dados.id}`, {
      metodo: "PUT", token: token1, corpo: { manutencaoPorKm: 1000000 },
    });
    assert.equal(manutencaoForaDoDecimal.status, 400);
    const manutencaoPrecisaoExcedida = await requisitar(`/precificacao/custos/${cadastroVeiculo.dados.id}`, {
      metodo: "PUT", token: token1, corpo: { manutencaoPorKm: 0.00001 },
    });
    assert.equal(manutencaoPrecisaoExcedida.status, 400);
    const custosNoLimiteSql = await requisitar(`/precificacao/custos/${cadastroVeiculo.dados.id}`, {
      metodo: "PUT", token: token1, corpo: { custoCapitalMensal: 9999999999.99, manutencaoPorKm: 999999.9999 },
    });
    assert.equal(custosNoLimiteSql.status, 200);
    const custosZerados = await requisitar(`/precificacao/custos/${cadastroVeiculo.dados.id}`, {
      metodo: "PUT", token: token1, corpo: { custoCapitalMensal: 0, manutencaoPorKm: 0 },
    });
    assert.equal(custosZerados.status, 200);
    const tarifaBase = await requisitar("/precificacao/tarifas", {
      metodo: "POST",
      token: token1,
      corpo: {
        categoriaId: categoria.id,
        valorDiaria: 120.55,
        valorSemanal: null,
        valorMensal: null,
        vigenciaInicio: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        vigenciaFim: null,
        ativo: true,
      },
    });
    assert.equal(tarifaBase.status, 201);
    const diariaAbaixoDoPiso = await requisitar(`/precificacao/tarifas/${tarifaBase.dados.id}`, {
      metodo: "PATCH", token: token1, corpo: { valorDiaria: 10 },
    });
    assert.equal(diariaAbaixoDoPiso.status, 409);
    const semanalAbaixoDoPiso = await requisitar(`/precificacao/tarifas/${tarifaBase.dados.id}`, {
      metodo: "PATCH", token: token1, corpo: { valorSemanal: 90 },
    });
    assert.equal(semanalAbaixoDoPiso.status, 409);
    const recomendacaoPrecificacao = await requisitar("/precificacao/admin", { token: token1 });
    assert.equal(recomendacaoPrecificacao.status, 200);
    const veiculoComRecomendacao = recomendacaoPrecificacao.dados.veiculos.find((item) => item.id === cadastroVeiculo.dados.id);
    assert.equal(veiculoComRecomendacao.recomendacaoCusto.completo, true);
    assert.equal(Number(veiculoComRecomendacao.recomendacaoCusto.diariaMinima), 13.89);
    const opcoesPrecificacao = await requisitar(`/precificacao/opcoes/${cadastroVeiculo.dados.id}`, { token: token1 });
    assert.equal(opcoesPrecificacao.status, 200);
    assert.ok(Array.isArray(opcoesPrecificacao.dados.adicionais));
    assert.ok(Array.isArray(opcoesPrecificacao.dados.protecoes));
    assert.ok(opcoesPrecificacao.dados.taxasDisponiveis);

    const manutencao = await requisitar(
      `/veiculos/${cadastroVeiculo.dados.id}/manutencoes`,
      {
        metodo: "POST",
        token: token1,
        corpo: {
          data: "2026-10-20T12:00:00.000Z",
          tipo: "Preventiva",
          descricao: "Troca de óleo",
          valor: 350,
          km: 50000,
        },
      },
    );
    assert.equal(manutencao.status, 201);
    const sinistro = await requisitar(
      `/veiculos/${cadastroVeiculo.dados.id}/sinistros`,
      {
        metodo: "POST",
        token: token1,
        corpo: {
          data: "2026-10-21T12:00:00.000Z",
          descricao: "Avaria no para-choque",
          valorReparo: 1500,
          status: "aberto",
        },
      },
    );
    assert.equal(sinistro.status, 201);
    const multa = await requisitar(
      `/veiculos/${cadastroVeiculo.dados.id}/multas`,
      {
        metodo: "POST",
        token: token1,
        corpo: {
          data: "2026-10-22T12:00:00.000Z",
          infracao: "Estacionamento",
          valor: 120,
          status: "pendente",
        },
      },
    );
    assert.equal(multa.status, 201);
    const vistoria = await requisitar(
      `/veiculos/${cadastroVeiculo.dados.id}/vistorias`,
      {
        metodo: "POST",
        token: token1,
        corpo: {
          data: "2026-10-23T12:00:00.000Z",
          tipo: "saida",
          km: 50000,
          nivelCombustivel: 80,
          observacoes: "Sem avarias aparentes",
        },
      },
    );
    assert.equal(vistoria.status, 201);
    const historicoVeiculo = await requisitar(
      `/veiculos/${cadastroVeiculo.dados.id}/historico`,
      { token: token1 },
    );
    assert.equal(historicoVeiculo.status, 200);
    assert.equal(historicoVeiculo.dados.manutencoes.length, 1);
    assert.equal(historicoVeiculo.dados.sinistros.length, 1);
    assert.equal(historicoVeiculo.dados.multas.length, 1);
    assert.equal(historicoVeiculo.dados.vistorias.length, 1);

    const placaDuplicada = await requisitar("/veiculos", {
      metodo: "POST",
      token: token1,
      corpo: dadosVeiculo,
    });
    assert.equal(placaDuplicada.status, 409);

    const inicio = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const devolucao = new Date(inicio.getTime() + 25 * 60 * 60 * 1000);
    const dadosLocacao = {
      veiculoId: cadastroVeiculo.dados.id,
      dataInicio: inicio.toISOString(),
      dataPrevistaDevolucao: devolucao.toISOString(),
      formaPagamento: "credito",
      parcelas: 1,
    };
    const clienteReserva = await requisitar("/clientes", {
      metodo: "POST",
      token: token1,
      corpo: {
        nome: `Cliente de Reserva ${sufixo}`,
        email: `cliente-reserva-${sufixo}@example.test`,
      },
    });
    assert.equal(clienteReserva.status, 201);
    const dadosLocacaoAdmin = {
      ...dadosLocacao,
      clienteId: clienteReserva.dados.id,
    };
    const cotacao = await requisitar("/precificacao/cotacao", {
      metodo: "POST",
      token: token1,
      corpo: dadosLocacaoAdmin,
    });
    assert.equal(cotacao.status, 200);
    assert.equal(Number(cotacao.dados.valorTotal), 241.1);
    assert.equal(Number(cotacao.dados.valorCaucao), 2345.67);
    const cadastroLocacao = await requisitar("/locacoes", {
      metodo: "POST",
      token: token1,
      corpo: dadosLocacaoAdmin,
    });
    assert.equal(cadastroLocacao.status, 201);
    assert.equal(cadastroLocacao.dados.status, "reservada");
    assert.equal(Number(cadastroLocacao.dados.valorTotal), 241.1);
    assert.equal(Number(cadastroLocacao.dados.preco.valorTotal), 241.1);
    assert.equal(Number(cadastroLocacao.dados.preco.valorCaucao), 2345.67);
    assert.equal(cadastroLocacao.dados.preco.regrasAplicadas.versao, 1);
    const tarifaAtualizada = await requisitar(`/precificacao/tarifas/${tarifaBase.dados.id}`, {
      metodo: "PATCH",
      token: token1,
      corpo: { valorDiaria: 999 },
    });
    assert.equal(tarifaAtualizada.status, 200);
    const locacaoComSnapshot = await requisitar(`/locacoes/${cadastroLocacao.dados.id}`, { token: token1 });
    assert.equal(Number(locacaoComSnapshot.dados.preco.valorTotal), 241.1);
    assert.equal(Number(locacaoComSnapshot.dados.valorTotal), 241.1);
    const locacoesDoVeiculo = await requisitar(
      `/veiculos/${cadastroVeiculo.dados.id}/locacoes`,
      { token: token1 },
    );
    assert.equal(locacoesDoVeiculo.status, 200);
    assert.equal(locacoesDoVeiculo.dados.length, 1);
    assert.equal(locacoesDoVeiculo.dados[0].id, cadastroLocacao.dados.id);
    assert.equal(locacoesDoVeiculo.dados[0].status, "reservada");
    assert.equal(Object.hasOwn(locacoesDoVeiculo.dados[0], "usuarioId"), false);

    const multaVinculada = await requisitar(
      `/veiculos/${cadastroVeiculo.dados.id}/multas`,
      {
        metodo: "POST",
        token: token1,
        corpo: {
          data: "2026-10-24T12:00:00.000Z",
          infracao: "Infração vinculada à locação",
          valor: 80,
          status: "pendente",
          locacaoId: cadastroLocacao.dados.id,
        },
      },
    );
    assert.equal(multaVinculada.status, 201);
    assert.equal(multaVinculada.dados.locacaoId, cadastroLocacao.dados.id);
    const vistoriaVinculada = await requisitar(
      `/veiculos/${cadastroVeiculo.dados.id}/vistorias`,
      {
        metodo: "POST",
        token: token1,
        corpo: {
          data: "2026-10-24T12:00:00.000Z",
          tipo: "entrada",
          km: 50050,
          nivelCombustivel: 65,
          observacoes: "Devolução de integração",
          locacaoId: cadastroLocacao.dados.id,
        },
      },
    );
    assert.equal(vistoriaVinculada.status, 201);
    assert.equal(vistoriaVinculada.dados.locacaoId, cadastroLocacao.dados.id);
    const historicoComVinculos = await requisitar(
      `/veiculos/${cadastroVeiculo.dados.id}/historico`,
      { token: token1 },
    );
    assert.equal(historicoComVinculos.dados.multas.length, 2);
    assert.equal(historicoComVinculos.dados.vistorias.length, 2);
    assert.ok(
      historicoComVinculos.dados.multas.some(
        (item) => item.locacaoId === cadastroLocacao.dados.id,
      ),
    );
    assert.ok(
      historicoComVinculos.dados.vistorias.some(
        (item) => item.locacaoId === cadastroLocacao.dados.id,
      ),
    );

    const veiculosDisponiveis = await requisitar("/veiculos?disponivel=true", {
      token: token1,
    });
    assert.equal(veiculosDisponiveis.status, 200);
    assert.equal(
      veiculosDisponiveis.dados.some(
        (item) => item.id === cadastroVeiculo.dados.id,
      ),
      false,
    );

    const locacaoDuplicada = await requisitar("/locacoes", {
      metodo: "POST",
      token: token1,
      corpo: dadosLocacaoAdmin,
    });
    assert.equal(locacaoDuplicada.status, 409);

    const registro2 = await requisitar("/auth/register", {
      metodo: "POST",
      corpo: credenciais2,
    });
    assert.equal(registro2.status, 201);
    const login2 = await requisitar("/auth/login", {
      metodo: "POST",
      corpo: { email: credenciais2.email, senha: credenciais2.senha },
    });
    assert.equal(login2.status, 200);
    const token2 = login2.dados.token;
    assert.equal((await requisitar("/precificacao/admin", { token: token2 })).status, 403);
    assert.equal((await requisitar("/precificacao/cotacao", { metodo: "POST", token: token2, corpo: dadosLocacao })).status, 409);
    const locacoesDoVeiculoUser = await requisitar(
      `/veiculos/${cadastroVeiculo.dados.id}/locacoes`,
      { token: token2 },
    );
    assert.equal(locacoesDoVeiculoUser.status, 403);

    const consultaAlheia = await requisitar(
      `/locacoes/${cadastroLocacao.dados.id}`,
      { token: token2 },
    );
    assert.equal(consultaAlheia.status, 403);
    const finalizacaoAlheia = await requisitar(
      `/locacoes/${cadastroLocacao.dados.id}/finalizar`,
      {
        metodo: "PATCH",
        token: token2,
      },
    );
    assert.equal(finalizacaoAlheia.status, 403);

    const historicoAntes = await requisitar("/locacoes", { token: token1 });
    assert.equal(historicoAntes.status, 200);
    assert.equal(historicoAntes.dados.length, 1);

    const checklistLocacao = await requisitar("/locacoes/checklist", { token: token1 });
    assert.equal(checklistLocacao.status, 200);
    const respostasChecklist = checklistLocacao.dados.map((item) => ({ itemId: item.id, conforme: true }));
    // A reserva foi criada com antecedência; avance o período persistido para simular os dias até a retirada/devolução.
    await prisma.locacao.update({
      where: { id: cadastroLocacao.dados.id },
      data: {
        dataInicio: new Date(Date.now() - 26 * 60 * 60 * 1000),
        dataPrevistaDevolucao: new Date(Date.now() - 60 * 60 * 1000),
      },
    });
    const corposTransicao = {
      retirar: { vistoria: { km: 50000, nivelCombustivel: 80, itensChecklist: respostasChecklist } },
      iniciar: {},
      devolver: { vistoria: { km: 50010, nivelCombustivel: 80, itensChecklist: respostasChecklist } },
    };
    for (const etapa of ['retirar','iniciar','devolver']) {
      const resultadoEtapa = await requisitar(`/locacoes/${cadastroLocacao.dados.id}/${etapa}`, {
        metodo: 'PATCH', token: token1, corpo: corposTransicao[etapa],
      });
      assert.equal(resultadoEtapa.status, 200, `${etapa}: ${JSON.stringify(resultadoEtapa.dados)}`);
    }
    const finalizacao = await requisitar(
      `/locacoes/${cadastroLocacao.dados.id}/finalizar`,
      {
        metodo: "PATCH",
        token: token1,
      },
    );
    assert.equal(finalizacao.status, 200);
    assert.equal(finalizacao.dados.status, "finalizada");
    assert.ok(finalizacao.dados.dataDevolucaoEfetiva);
    assert.equal(finalizacao.dados.veiculo.status, "disponivel");
    const locacoesDepoisDeFinalizar = await requisitar(
      `/veiculos/${cadastroVeiculo.dados.id}/locacoes`,
      { token: token1 },
    );
    assert.equal(locacoesDepoisDeFinalizar.dados.length, 1);
    assert.equal(locacoesDepoisDeFinalizar.dados[0].status, "finalizada");

    const finalizacaoRepetida = await requisitar(
      `/locacoes/${cadastroLocacao.dados.id}/finalizar`,
      {
        metodo: "PATCH",
        token: token1,
      },
    );
    assert.equal(finalizacaoRepetida.status, 409);

    const historicoDepois = await requisitar("/locacoes", { token: token1 });
    assert.equal(historicoDepois.status, 200);
    assert.equal(historicoDepois.dados.length, 1);
    assert.equal(historicoDepois.dados[0].status, "finalizada");

    const veiculosDisponiveisDepois = await requisitar(
      "/veiculos?disponivel=true",
      { token: token1 },
    );
    assert.equal(
      veiculosDisponiveisDepois.dados.some(
        (item) => item.id === cadastroVeiculo.dados.id,
      ),
      true,
    );
  },
);
