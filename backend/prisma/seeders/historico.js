function instanteUTC(texto) {
  return new Date(`${texto}Z`);
}

async function seedHistorico(prisma, contexto, configuracoes) {
  const { veiculos, categorias, filiais, administradorDemo, clienteExemplo } = contexto;
  const { adicionais, protecoes } = configuracoes;
  const veiculo = veiculos["DME0S01"];
  if (!veiculo) return { locacaoDemo: null };

  const categoria = categorias["Sedan"];
  const filialRetirada = filiais["Matriz"];
  const filialDevolucao = filiais["Unidade Aeroporto"];
  const adicional = adicionais["DEMO · Cadeira infantil"];
  const protecao = protecoes["DEMO · Proteção ampliada"];
  const codigo = "DEMO-2026-001";
  const inicio = instanteUTC("2026-02-10T09:00:00.000");
  const devolucao = instanteUTC("2026-02-13T09:00:00.000");

  let locacao = await prisma.locacao.findUnique({ where: { codigo } });
  if (locacao && !String(locacao.observacoes || "").startsWith("[DEMO]")) {
    throw new Error(`O código reservado ${codigo} pertence a uma locação não DEMO; nenhum dado foi alterado.`);
  }
  if (!locacao) {
    locacao = await prisma.locacao.create({
      data: {
        codigo,
        clienteId: clienteExemplo.id,
        veiculoId: veiculo.id,
        categoriaId: categoria.id,
        status: "finalizada",
        origem: "site",
        atendenteId: administradorDemo.id,
        dataInicio: inicio,
        dataPrevistaDevolucao: devolucao,
        retiradaReal: inicio,
        dataDevolucaoEfetiva: devolucao,
        qtdDiariasPrevistas: 3,
        qtdDiariasCobradas: 3,
        filialRetiradaId: filialRetirada.id,
        filialDevolucaoId: filialDevolucao.id,
        kmSaida: 12100,
        kmEntrada: 12340,
        kmFranquiaTotal: 450,
        combustivelSaida: 80,
        combustivelEntrada: 80,
        valorTotal: "1010.00",
        valorFinalCobrado: "1065.00",
        caucaoValor: "1000.00",
        caucaoStatus: "liberada",
        formaPagamento: "pix",
        parcelas: 1,
        contratoTexto: "[DEMONSTRAÇÃO] Registro fictício para demonstrar o fluxo. Não constitui contrato real.",
        contratoAssinado: false,
        observacoes: "[DEMO] Dados fictícios criados pelo seeder local.",
      },
    });
  }

  await prisma.locacaoPreco.upsert({
    where: { locacaoId: locacao.id },
    update: {},
    create: {
      locacaoId: locacao.id,
      valorDiariaAplicada: "300.00",
      qtdDiarias: 3,
      subtotalDiarias: "900.00",
      totalAdicionais: "54.00",
      totalProtecoes: "30.00",
      descontoTotal: "0.00",
      impostosTaxas: "26.00",
      valorTotal: "1010.00",
      valorCaucao: "1000.00",
      regrasAplicadas: [{ nome: "DEMO · Tarifa de demonstração", tipo: "diaria", valor: "300.00" }],
    },
  });

  await prisma.locacaoMotorista.upsert({
    where: { locacaoId_clienteId: { locacaoId: locacao.id, clienteId: clienteExemplo.id } },
    update: {},
    create: { locacaoId: locacao.id, clienteId: clienteExemplo.id, principal: true },
  });

  if (adicional) {
    await prisma.locacaoAdicional.upsert({
      where: { locacaoId_adicionalId: { locacaoId: locacao.id, adicionalId: adicional.id } },
      update: {},
      create: {
        locacaoId: locacao.id,
        adicionalId: adicional.id,
        quantidade: 1,
        valorUnitario: "18.00",
        valorTotal: "54.00",
      },
    });
  }

  if (protecao) {
    await prisma.locacaoProtecao.upsert({
      where: { locacaoId_protecaoId: { locacaoId: locacao.id, protecaoId: protecao.id } },
      update: {},
      create: {
        locacaoId: locacao.id,
        protecaoId: protecao.id,
        valorDiaria: "10.00",
        valorTotal: "30.00",
      },
    });
  }

  const transicoes = [
    ["reservada", "retirada", "2026-02-10T09:00:00.000"],
    ["retirada", "em_andamento", "2026-02-10T09:02:00.000"],
    ["em_andamento", "devolvida", "2026-02-13T09:00:00.000"],
    ["devolvida", "finalizada", "2026-02-13T09:10:00.000"],
  ];
  for (const [statusAnterior, statusNovo, data] of transicoes) {
    const existente = await prisma.locacaoStatusHistorico.findFirst({
      where: { locacaoId: locacao.id, statusAnterior, statusNovo },
    });
    if (!existente) {
      await prisma.locacaoStatusHistorico.create({
        data: {
          locacaoId: locacao.id,
          statusAnterior,
          statusNovo,
          usuarioId: administradorDemo.id,
          alteradoEm: instanteUTC(data),
        },
      });
    }
  }

  const vistorias = {};
  for (const vistoria of [
    {
      tipo: "saida",
      data: "2026-02-10T09:00:00.000",
      km: 12100,
      combustivel: 80,
      observacoes: "[DEMO] Vistoria de saída ilustrativa.",
      itensChecklist: [
        { descricao: "Carroceria e pintura", conforme: true },
        { descricao: "Pneus e estepe", conforme: true },
        { descricao: "Faróis e lanternas", conforme: true },
      ],
    },
    {
      tipo: "entrada",
      data: "2026-02-13T09:00:00.000",
      km: 12340,
      combustivel: 80,
      observacoes: "[DEMO] Vistoria de entrada ilustrativa.",
      itensChecklist: [
        { descricao: "Carroceria e pintura", conforme: true },
        { descricao: "Pneus e estepe", conforme: true },
        { descricao: "Faróis e lanternas", conforme: true },
      ],
    },
  ]) {
    let registro = await prisma.vistoria.findFirst({
      where: { veiculoId: veiculo.id, locacaoId: locacao.id, tipo: vistoria.tipo, data: instanteUTC(vistoria.data) },
    });
    if (!registro) {
      registro = await prisma.vistoria.create({
        data: {
          veiculoId: veiculo.id,
          locacaoId: locacao.id,
          tipo: vistoria.tipo,
          data: instanteUTC(vistoria.data),
          km: vistoria.km,
          nivelCombustivel: vistoria.combustivel,
          observacoes: vistoria.observacoes,
          itensChecklist: vistoria.itensChecklist,
        },
      });
    }
    vistorias[vistoria.tipo] = registro;
  }

  const locacaoComVistorias = await prisma.locacao.findUnique({
    where: { id: locacao.id },
    select: { vistoriaSaidaId: true, vistoriaEntradaId: true },
  });
  const atualizacaoVistorias = {};
  if (!locacaoComVistorias.vistoriaSaidaId) atualizacaoVistorias.vistoriaSaidaId = vistorias.saida.id;
  if (!locacaoComVistorias.vistoriaEntradaId) atualizacaoVistorias.vistoriaEntradaId = vistorias.entrada.id;
  if (Object.keys(atualizacaoVistorias).length) {
    await prisma.locacao.update({ where: { id: locacao.id }, data: atualizacaoVistorias });
  }

  const infracao = "DEMO · Infração de trânsito ilustrativa";
  let multa = await prisma.multa.findFirst({
    where: { veiculoId: veiculo.id, locacaoId: locacao.id, infracao },
  });
  if (!multa) {
    multa = await prisma.multa.create({
      data: {
        veiculoId: veiculo.id,
        locacaoId: locacao.id,
        data: instanteUTC("2026-02-11T12:00:00.000"),
        infracao,
        valor: "40.00",
        status: "pendente",
      },
    });
  }
  await prisma.locacaoCobrancaExtra.upsert({
    where: { multaId: multa.id },
    update: {},
    create: {
      locacaoId: locacao.id,
      multaId: multa.id,
      tipo: "multa_transito",
      descricao: "[DEMO] Infração de trânsito + taxa administrativa fictícias.",
      valor: "55.00",
    },
  });

  const pagamentosDemo = [
    { tipo: "reserva", valor: "100.00", status: "pago", pagoEm: instanteUTC("2026-02-10T08:50:00.000") },
    { tipo: "saldo", valor: "910.00", status: "pago", pagoEm: instanteUTC("2026-02-10T08:55:00.000") },
    { tipo: "caucao", valor: "1000.00", status: "estornado", pagoEm: instanteUTC("2026-02-13T09:15:00.000") },
    { tipo: "saldo", valor: "55.00", status: "pendente", pagoEm: null },
  ];
  for (const pagamento of pagamentosDemo) {
    const gatewayId = `DEMO-SEED-${codigo}-${pagamento.tipo}-${pagamento.valor}`;
    const existente = await prisma.locacaoPagamento.findFirst({
      where: { locacaoId: locacao.id, gatewayId },
    });
    if (!existente) {
      await prisma.locacaoPagamento.create({
        data: {
          locacaoId: locacao.id,
          tipo: pagamento.tipo,
          valor: pagamento.valor,
          status: pagamento.status,
          gatewayId,
          pagoEm: pagamento.pagoEm,
        },
      });
    }
  }

  const manutenencaoData = instanteUTC("2026-01-15T00:00:00.000");
  const manutencao = await prisma.manutencao.findFirst({
    where: { veiculoId: veiculo.id, data: manutenencaoData, tipo: "DEMO · Revisão periódica" },
  });
  if (!manutencao) {
    await prisma.manutencao.create({
      data: {
        veiculoId: veiculo.id,
        data: manutenencaoData,
        tipo: "DEMO · Revisão periódica",
        descricao: "[DEMO] Revisão ilustrativa para apresentação do histórico de manutenção.",
        valor: "850.00",
        km: 11800,
      },
    });
  }

  const dataAvaria = instanteUTC("2026-03-01T00:00:00.000");
  const avariaDescricao = "[DEMO] Registro ilustrativo de avaria reparada.";
  const avaria = await prisma.sinistroAvaria.findFirst({
    where: { veiculoId: veiculo.id, data: dataAvaria, descricao: avariaDescricao },
  });
  if (!avaria) {
    await prisma.sinistroAvaria.create({
      data: {
        veiculoId: veiculo.id,
        data: dataAvaria,
        descricao: avariaDescricao,
        valorReparo: "250.00",
        status: "resolvido",
      },
    });
  }

  return { locacaoDemo: locacao, multaDemo: multa };
}

module.exports = { seedHistorico };
