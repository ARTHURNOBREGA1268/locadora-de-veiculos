const calculo = require("../../src/services/precificacao.calculo");

function dataUTC(texto) {
  return new Date(`${texto}T00:00:00.000Z`);
}

function proximoValor(valor, fator) {
  return (Math.ceil(Number(valor) * fator * 100) / 100).toFixed(2);
}

async function protecaoSeAusente(prisma, dados) {
  const existente = await prisma.protecao.findFirst({ where: { nome: dados.nome } });
  if (existente) return existente;
  return prisma.protecao.create({ data: dados });
}

async function adicionalSeAusente(prisma, dados) {
  const existente = await prisma.adicional.findFirst({ where: { nome: dados.nome } });
  if (existente) return existente;
  return prisma.adicional.create({ data: dados });
}

async function regraSeAusente(prisma, dados) {
  const existente = await prisma.regraPreco.findFirst({ where: { nome: dados.nome } });
  if (existente) return existente;
  return prisma.regraPreco.create({ data: dados });
}

async function seedConfiguracoes(prisma, contexto) {
  const { categorias, filiais, veiculos } = contexto;

  const configLocacaoNova = !(await prisma.configuracaoLocacao.findUnique({ where: { id: 1 } }));
  const configLocacao = await prisma.configuracaoLocacao.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      periodoMinimoDiarias: 1,
      periodoMaximoDiarias: 30,
      horarioRetiradaPadrao: new Date("1970-01-01T09:00:00.000Z"),
      horarioDevolucaoPadrao: new Date("1970-01-01T09:00:00.000Z"),
      toleranciaAtrasoMinutos: 30,
      antecedenciaMinimaHoras: 0,
      antecedenciaMaximaDias: 365,
      cancelamentoPrazoHoras: 24,
      cancelamentoMultaPercentual: "10.00",
      idadeMinima: 21,
      tempoMinimoCnhMeses: 12,
      documentosExigidos: ["CNH válida", "Documento oficial com foto"],
      exigeCartaoCredito: true,
      permiteMotoristaAdicional: true,
      maxMotoristasAdicionais: 2,
      kmLivre: false,
      kmFranquiaDiaria: 150,
      politicaCombustivel: "mesmo_nivel",
      permiteDevolucaoOutraFilial: true,
      permiteEntregaDomicilio: true,
      permiteRetiradaAeroporto: true,
      raioEntregaKm: 25,
      protecaoBasicaInclusa: true,
      exigeVistoriaSaida: true,
      exigeVistoriaEntrada: true,
      modeloContrato: "[DEMONSTRAÇÃO] Modelo ilustrativo. Substitua e valide este texto antes de usar como contrato real.",
    },
  });

  if (configLocacaoNova) {
    for (const filial of Object.values(filiais)) {
      for (const tipo of ["retirada", "devolucao"]) {
        await prisma.configFilial.upsert({
          where: { configId_filialId_tipo: { configId: configLocacao.id, filialId: filial.id, tipo } },
          update: {},
          create: { configId: configLocacao.id, filialId: filial.id, tipo },
        });
      }
    }

    const itensChecklist = [
      "Carroceria e pintura",
      "Pneus e estepe",
      "Faróis e lanternas",
      "Vidros e retrovisores",
      "Interior e bancos",
      "Nível de combustível",
      "Quilometragem do veículo",
      "Triângulo e itens de segurança",
    ];
    for (let index = 0; index < itensChecklist.length; index += 1) {
      const descricao = itensChecklist[index];
      const existente = await prisma.checklistItem.findFirst({
        where: { configId: configLocacao.id, descricao },
      });
      if (!existente) {
        await prisma.checklistItem.create({
          data: { configId: configLocacao.id, descricao, obrigatorio: true, ordem: index + 1 },
        });
      }
    }
  }

  const configPrecoExistente = await prisma.configuracaoPrecificacao.findUnique({ where: { id: 1 } });
  const configPrecoNova = !configPrecoExistente;
  const configPreco = await prisma.configuracaoPrecificacao.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      ocupacaoAlvoPercentual: "70.00",
      margemDesejadaPercentual: "30.00",
      custoAdministrativoMensal: "900.00",
      kmMedioDiario: 45,
      limpezaPorLocacao: "90.00",
      diasMediosLocacao: 3,
      comissaoPercentual: "3.00",
      taxaPagamentoPercentual: "2.00",
      valorKmExcedente: "2.00",
      taxaReposicaoCombustivel: "75.00",
      taxaCombustivelPorLitro: "5.50",
      taxaLimpeza: "90.00",
      taxaAeroporto: "45.00",
      taxaOutraFilial: "50.00",
      taxaEntregaDomicilioFixa: "25.00",
      taxaEntregaPorKm: "2.00",
      atrasoToleranciaMinutos: 30,
      atrasoValorHoraPercentual: "10.00",
      atrasoLimiteHorasViraDiaria: 4,
      multaCancelamentoPercentual: "10.00",
      taxaAdminMultaTransito: "15.00",
      issPercentual: "5.00",
      taxaCartaoPercentual: "2.99",
      parcelamentoMax: 6,
      parcelamentoJurosPercentual: "0.00",
      precoMinimoMargemPercentual: "10.00",
    },
  });

  const existeTarifaAtiva = await prisma.tarifaBase.findFirst({ where: { ativo: true }, select: { id: true } });
  const semPrecificacaoPreexistente = configPrecoNova && !existeTarifaAtiva;
  const custoPorCategoria = new Map();
  if (semPrecificacaoPreexistente) {
    for (const [placa, veiculo] of Object.entries(veiculos)) {
      const compra = Number(veiculo.valorCompra || 0);
      if (compra <= 0 || !veiculo.valorRevendaEstimado || !veiculo.vidaUtilMeses) continue;
      const custo = {
        veiculoId: veiculo.id,
        custoCapitalMensal: (compra * 0.002).toFixed(2),
        ipvaAnual: (compra * 0.04).toFixed(2),
        seguroAnual: (compra * 0.055).toFixed(2),
        licenciamentoAnual: "300.00",
        manutencaoPorKm: placa === "DME0L01" ? "0.4200" : "0.2400",
      };
      const custoSalvo = await prisma.custoPrecificacaoVeiculo.upsert({
        where: { veiculoId: veiculo.id },
        update: {},
        create: custo,
      });
      const minimo = calculo.calcularCustoMinimo(veiculo, custoSalvo, configPreco);
      if (minimo.completo) {
        const anterior = custoPorCategoria.get(veiculo.categoriaId) || 0;
        if (minimo.minimoDiario.toNumber() > anterior)
          custoPorCategoria.set(veiculo.categoriaId, minimo.minimoDiario.toNumber());
      }
    }
  }

  const tarifasCriadas = [];
  const inicioVigencia = dataUTC(`${new Date().getUTCFullYear()}-01-01`);
  for (const [nome, categoria] of Object.entries(categorias)) {
    if (configLocacaoNova) {
      const indice = Object.keys(categorias).indexOf(nome);
      await prisma.franquiaCategoria.upsert({
        where: { configId_categoriaId: { configId: configLocacao.id, categoriaId: categoria.id } },
        update: {},
        create: { configId: configLocacao.id, categoriaId: categoria.id, valor: (2500 + indice * 500).toFixed(2) },
      });
      await prisma.caucaoCategoria.upsert({
        where: { configId_categoriaId: { configId: configLocacao.id, categoriaId: categoria.id } },
        update: {},
        create: { configId: configLocacao.id, categoriaId: categoria.id, valor: (500 + indice * 250).toFixed(2) },
      });
    }

    if (semPrecificacaoPreexistente) {
      const pisoCalculado = custoPorCategoria.get(categoria.id) || 150;
      const piso = (Math.ceil(pisoCalculado * 100) / 100).toFixed(2);
      await prisma.precoPisoCategoria.upsert({
        where: { categoriaId: categoria.id },
        update: {},
        create: { categoriaId: categoria.id, valor: piso },
      });
      const diaria = proximoValor(pisoCalculado, 1.2);
      const semanal = proximoValor(Number(diaria) * 7, 0.95);
      const mensal = proximoValor(Number(diaria) * 30, 0.93);
      const tarifa = await prisma.tarifaBase.create({
        data: {
          categoriaId: categoria.id,
          valorDiaria: diaria,
          valorSemanal: semanal,
          valorMensal: mensal,
          vigenciaInicio: inicioVigencia,
          vigenciaFim: null,
          ativo: true,
        },
      });
      tarifasCriadas.push(tarifa.id);
    }
  }

  const regras = [
    {
      nome: "DEMO · Alta temporada de verão",
      tipo: "sazonalidade",
      dataInicio: dataUTC("2026-12-15"),
      dataFim: dataUTC("2027-01-15"),
      tipoAjuste: "percentual",
      valorAjuste: "15.00",
      prioridade: 1,
      acumulavel: false,
      ativo: true,
    },
    {
      nome: "DEMO · Ajuste por alta ocupação",
      tipo: "ocupacao",
      ocupacaoMinPercentual: "85.00",
      tipoAjuste: "percentual",
      valorAjuste: "10.00",
      prioridade: 5,
      acumulavel: false,
      ativo: true,
    },
    {
      nome: "DEMO · Desconto para locações semanais",
      tipo: "duracao",
      duracaoMinDiarias: 7,
      tipoAjuste: "percentual",
      valorAjuste: "-5.00",
      prioridade: 10,
      acumulavel: true,
      ativo: true,
    },
    {
      nome: "DEMO · Planejamento antecipado",
      tipo: "antecedencia",
      antecedenciaMinDias: 14,
      tipoAjuste: "percentual",
      valorAjuste: "-3.00",
      prioridade: 20,
      acumulavel: true,
      ativo: true,
    },
  ];
  if (semPrecificacaoPreexistente) {
    for (const regra of regras) await regraSeAusente(prisma, regra);
  }

  const adicionais = {};
  const dadosAdicionais = [
    { nome: "DEMO · Cadeira infantil", tipoCobranca: "por_diaria", valor: "18.00", valorMaximoLocacao: "180.00", ativo: true },
    { nome: "DEMO · Motorista adicional", tipoCobranca: "por_locacao", valor: "65.00", valorMaximoLocacao: null, ativo: true },
    { nome: "DEMO · Wi-Fi portátil", tipoCobranca: "por_diaria", valor: "12.00", valorMaximoLocacao: "120.00", ativo: true },
  ];
  for (const item of dadosAdicionais) adicionais[item.nome] = await adicionalSeAusente(prisma, item);

  const protecoes = {};
  const dadosProtecao = [
    { nome: "DEMO · Proteção básica", descricao: "Cobertura de demonstração incluída conforme configuração do contrato.", ativo: true },
    { nome: "DEMO · Proteção ampliada", descricao: "Cobertura adicional de demonstração, sujeita à categoria do veículo.", ativo: true },
  ];
  for (const item of dadosProtecao) protecoes[item.nome] = await protecaoSeAusente(prisma, item);

  for (const protecao of Object.values(protecoes)) {
    if (configLocacaoNova) {
      await prisma.protecaoConfig.upsert({
        where: { configId_protecaoId: { configId: configLocacao.id, protecaoId: protecao.id } },
        update: {},
        create: { configId: configLocacao.id, protecaoId: protecao.id, selecionada: false },
      });
    }
    for (const [indice, categoria] of Object.values(categorias).entries()) {
      const existente = await prisma.protecaoPreco.findFirst({
        where: { protecaoId: protecao.id, categoriaId: categoria.id },
      });
      if (!existente) {
        await prisma.protecaoPreco.create({
          data: {
            protecaoId: protecao.id,
            categoriaId: categoria.id,
            valorDiaria: protecao.nome.includes("básica") ? "0.00" : (25 + indice * 4).toFixed(2),
            ativo: true,
          },
        });
      }
    }
  }

  const convenio = await prisma.convenio.upsert({
    where: { nome: "DEMO · Empresa parceira" },
    update: {},
    create: { nome: "DEMO · Empresa parceira", ativo: true },
  });
  const promocoes = [
    {
      codigoCupom: "DEMO10",
      descricao: "Cupom de demonstração de 10% para testes locais",
      tipoDesconto: "percentual",
      valorDesconto: "10.00",
      vigenciaInicio: dataUTC("2020-01-01"),
      vigenciaFim: dataUTC("2099-12-31"),
      limiteUsosTotal: 1000,
      limiteUsosPorCliente: 1,
      acumulavel: false,
      ativo: true,
    },
    {
      codigoCupom: "DEMOEMPRESA",
      descricao: "Convênio de demonstração para testes locais",
      tipoDesconto: "percentual",
      valorDesconto: "5.00",
      vigenciaInicio: dataUTC("2020-01-01"),
      vigenciaFim: dataUTC("2099-12-31"),
      limiteUsosTotal: 1000,
      limiteUsosPorCliente: 1,
      convenioId: convenio.id,
      acumulavel: false,
      ativo: true,
    },
  ];
  const cupons = {};
  for (const promocao of promocoes) {
    cupons[promocao.codigoCupom] = await prisma.promocao.upsert({
      where: { codigoCupom: promocao.codigoCupom },
      update: {},
      create: promocao,
    });
  }

  const fidelidade = [];
  for (const nivel of [
    { nome: "DEMO · Inicial", locacoesMinimas: 0, descontoPercentual: "0.00", ativo: true },
    { nome: "DEMO · Prata", locacoesMinimas: 3, descontoPercentual: "3.00", ativo: true },
    { nome: "DEMO · Ouro", locacoesMinimas: 10, descontoPercentual: "7.00", ativo: true },
  ]) {
    fidelidade.push(await prisma.nivelFidelidade.upsert({
      where: { locacoesMinimas: nivel.locacoesMinimas },
      update: {},
      create: nivel,
    }));
  }

  return {
    configLocacao,
    configPreco,
    adicionais,
    protecoes,
    cupons,
    fidelidade,
    tarifasCriadas,
  };
}

module.exports = { seedConfiguracoes };
