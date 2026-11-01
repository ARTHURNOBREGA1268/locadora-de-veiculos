import { useEffect, useRef, useState } from "react";
import { paraInputLocal, formatarMoeda } from "../utils/format";
import { mensagemDeErro } from "../services/api";
import * as precificacaoService from "../services/precificacaoService";

const VAZIO = {
  adicionais: [],
  protecoes: [],
  taxasDisponiveis: {},
  configuracaoLocacao: { exigeCartaoCredito: true },
  filiaisRetirada: [],
  filiaisDevolucao: [],
  valorCaucao: null,
};
const TAXAS_INICIAIS = {
  reporCombustivel: false,
  limpeza: false,
  aeroporto: false,
  entregaDomicilio: false,
  litrosCombustivel: "",
  distanciaEntregaKm: "",
};
const MOTORISTA_VAZIO = { nome: "", cpf: "", email: "", telefone: "" };

export default function LocacaoForm({ veiculos, veiculoInicial, onSubmit, admin = false, clientes = [] }) {
  const [veiculoId, setVeiculoId] = useState(veiculoInicial || "");
  const [clienteId, setClienteId] = useState("");
  const [dataInicio, setDataInicio] = useState(() => paraInputLocal(new Date()));
  const [dataDevolucao, setDataDevolucao] = useState("");
  const [opcoes, setOpcoes] = useState(VAZIO);
  const [carregandoOpcoes, setCarregandoOpcoes] = useState(false);
  const [erroOpcoes, setErroOpcoes] = useState("");
  const [adicionaisSelecionados, setAdicionaisSelecionados] = useState([]);
  const [protecoesSelecionadas, setProtecoesSelecionadas] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [cupom, setCupom] = useState("");
  const [convenioId, setConvenioId] = useState("");
  const [pagamento, setPagamento] = useState("credito");
  const [parcelas, setParcelas] = useState(1);
  const [filialRetiradaId, setFilialRetiradaId] = useState("");
  const [filialDevolucaoId, setFilialDevolucaoId] = useState("");
  const [origem, setOrigem] = useState("balcao");
  const [enderecoEntrega, setEnderecoEntrega] = useState("");
  const [enderecoColeta, setEnderecoColeta] = useState("");
  const [vooNumero, setVooNumero] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [taxas, setTaxas] = useState(TAXAS_INICIAIS);
  const [cotacao, setCotacao] = useState(null);
  const [cotando, setCotando] = useState(false);
  const [erroCotacao, setErroCotacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const sequenciaCotacao = useRef(0);

  useEffect(() => {
    if (veiculoInicial) setVeiculoId(String(veiculoInicial));
  }, [veiculoInicial]);

  useEffect(() => {
    setOpcoes(VAZIO);
    setCotacao(null);
    setErroOpcoes("");
    setErroCotacao("");
    setAdicionaisSelecionados([]);
    setProtecoesSelecionadas([]);
    setFilialRetiradaId("");
    setFilialDevolucaoId("");
    if (!veiculoId) {
      setCarregandoOpcoes(false);
      return undefined;
    }
    let atual = true;
    setCarregandoOpcoes(true);
    precificacaoService.obterOpcoes(Number(veiculoId))
      .then((response) => {
        if (!atual) return;
        const dados = {
          ...VAZIO,
          ...response,
          taxasDisponiveis: { ...VAZIO.taxasDisponiveis, ...(response.taxasDisponiveis || {}) },
          configuracaoLocacao: { ...VAZIO.configuracaoLocacao, ...(response.configuracaoLocacao || {}) },
        };
        setOpcoes(dados);
        const retirada = dados.filiaisRetirada.find((item) => item.id === dados.filialVeiculoId)?.id ?? dados.filiaisRetirada[0]?.id ?? "";
        const devolucao = dados.filiaisDevolucao.find((item) => item.id === retirada)?.id ?? dados.filiaisDevolucao[0]?.id ?? retirada;
        setFilialRetiradaId(String(retirada || ""));
        setFilialDevolucaoId(String(devolucao || ""));
      })
      .catch((error) => { if (atual) setErroOpcoes(mensagemDeErro(error)); })
      .finally(() => { if (atual) setCarregandoOpcoes(false); });
    return () => { atual = false; };
  }, [veiculoId]);

  const regrasLocacao = opcoes.configuracaoLocacao || VAZIO.configuracaoLocacao;
  const taxaConfig = opcoes.taxasDisponiveis || {};
  const exigeCartaoCredito = Boolean(regrasLocacao.exigeCartaoCredito);
  const filiaisRetirada = opcoes.filiaisRetirada || [];
  const filiaisDevolucao = opcoes.filiaisDevolucao || [];

  useEffect(() => {
    if (exigeCartaoCredito && pagamento !== "credito") setPagamento("credito");
  }, [exigeCartaoCredito, pagamento]);

  function payloadCotacao() {
    const outraFilial = Boolean(filialRetiradaId && filialDevolucaoId && Number(filialRetiradaId) !== Number(filialDevolucaoId));
    const body = {
      veiculoId: Number(veiculoId),
      dataInicio: new Date(dataInicio).toISOString(),
      dataPrevistaDevolucao: new Date(dataDevolucao).toISOString(),
      adicionais: adicionaisSelecionados.map((id) => ({ id, quantidade: 1 })),
      protecoes: protecoesSelecionadas,
      taxas: {
        reporCombustivel: Boolean(taxas.reporCombustivel),
        litrosCombustivel: taxas.litrosCombustivel === "" ? 0 : Number(taxas.litrosCombustivel),
        limpeza: Boolean(taxas.limpeza),
        aeroporto: Boolean(taxas.aeroporto),
        outraFilial,
        entregaDomicilio: Boolean(taxas.entregaDomicilio),
        distanciaEntregaKm: taxas.distanciaEntregaKm === "" ? 0 : Number(taxas.distanciaEntregaKm),
      },
      formaPagamento: pagamento,
      parcelas: pagamento === "credito" ? Number(parcelas) : 1,
    };
    if (admin && clienteId) body.clienteId = Number(clienteId);
    if (cupom.trim()) body.cupom = cupom.trim();
    if (convenioId) body.convenioId = Number(convenioId);
    return body;
  }

  function payloadReserva() {
    const body = {
      ...payloadCotacao(),
      filialRetiradaId: filialRetiradaId ? Number(filialRetiradaId) : undefined,
      filialDevolucaoId: filialDevolucaoId ? Number(filialDevolucaoId) : undefined,
      entregaDomicilio: Boolean(taxas.entregaDomicilio),
      enderecoEntrega: taxas.entregaDomicilio ? enderecoEntrega.trim() : undefined,
      enderecoColeta: taxas.entregaDomicilio ? enderecoColeta.trim() : undefined,
      distanciaEntregaKm: taxas.entregaDomicilio ? Number(taxas.distanciaEntregaKm) : undefined,
      vooNumero: taxas.aeroporto ? vooNumero.trim() : undefined,
      origem: admin ? origem : undefined,
      observacoes: observacoes.trim() || undefined,
      motoristas: motoristas.map((item) => ({
        nome: item.nome.trim(),
        cpf: item.cpf.trim(),
        email: item.email.trim() || undefined,
        telefone: item.telefone.trim() || undefined,
      })),
    };
    return body;
  }

  useEffect(() => {
    if (!veiculoId || !dataInicio || !dataDevolucao || carregandoOpcoes || erroOpcoes || (admin && !clienteId)) {
      setCotacao(null);
      setCotando(false);
      return undefined;
    }
    const inicio = new Date(dataInicio);
    const fim = new Date(dataDevolucao);
    if (!Number.isFinite(inicio.getTime()) || !Number.isFinite(fim.getTime()) || fim <= inicio) {
      setCotacao(null);
      setCotando(false);
      setErroCotacao("");
      return undefined;
    }
    const numero = ++sequenciaCotacao.current;
    setCotacao(null);
    setCotando(true);
    setErroCotacao("");
    const timer = setTimeout(() => {
      precificacaoService.cotar(payloadCotacao())
        .then((response) => { if (sequenciaCotacao.current === numero) setCotacao(response); })
        .catch((error) => { if (sequenciaCotacao.current === numero) setErroCotacao(mensagemDeErro(error)); })
        .finally(() => { if (sequenciaCotacao.current === numero) setCotando(false); });
    }, 350);
    return () => {
      clearTimeout(timer);
      if (sequenciaCotacao.current === numero) sequenciaCotacao.current += 1;
    };
  }, [veiculoId, clienteId, admin, dataInicio, dataDevolucao, carregandoOpcoes, erroOpcoes, adicionaisSelecionados, protecoesSelecionadas, cupom, convenioId, pagamento, parcelas, taxas, filialRetiradaId, filialDevolucaoId]);

  function alternar(setter, selecionados, id) {
    setter(selecionados.includes(id) ? selecionados.filter((value) => value !== id) : [...selecionados, id]);
  }
  function atualizarTaxa(campo, valor) {
    setTaxas((current) => ({ ...current, [campo]: valor }));
  }
  function atualizarMotorista(index, campo, valor) {
    setMotoristas((current) => current.map((item, i) => i === index ? { ...item, [campo]: valor } : item));
  }

  async function enviar(evento) {
    evento.preventDefault();
    if (!cotacao || cotando || (admin && !clienteId)) return;
    setEnviando(true);
    try {
      const sucesso = await onSubmit(payloadReserva());
      if (sucesso) {
        setVeiculoId("");
        setClienteId("");
        setDataInicio(paraInputLocal(new Date()));
        setDataDevolucao("");
        setCupom("");
        setConvenioId("");
        setPagamento("credito");
        setParcelas(1);
        setMotoristas([]);
        setFilialRetiradaId("");
        setFilialDevolucaoId("");
        setOrigem("balcao");
        setEnderecoEntrega("");
        setEnderecoColeta("");
        setVooNumero("");
        setObservacoes("");
        setTaxas(TAXAS_INICIAIS);
      }
    } finally {
      setEnviando(false);
    }
  }

  const exibirTaxa = (campo, rotulo, valor) => (
    <label className="config-check" key={campo}>
      <input type="checkbox" checked={Boolean(taxas[campo])} onChange={(event) => atualizarTaxa(campo, event.target.checked)} />
      {rotulo} · {formatarMoeda(valor)}
    </label>
  );

  return (
    <form className="painel formulario locacao-formulario" onSubmit={enviar}>
      <h2>Nova locação</h2>
      <div className="grade-campos">
        {admin && <label>Cliente da locação<select value={clienteId} required onChange={(event) => setClienteId(event.target.value)}><option value="">Selecione um cliente</option>{clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}{cliente.cpf ? ` — ${cliente.cpf}` : ""}{cliente.email ? ` · ${cliente.email}` : ""}{cliente.telefone ? ` · ${cliente.telefone}` : ""}</option>)}</select><span className="apoio">O cliente é independente da conta usada pela equipe.</span></label>}
        <label>Veículo disponível<select value={veiculoId} onChange={(event) => setVeiculoId(event.target.value)} required><option value="">Selecione um veículo</option>{veiculos.map((veiculo) => <option key={veiculo.id} value={veiculo.id}>{veiculo.marca} {veiculo.modelo} — {veiculo.placa}</option>)}</select></label>
        <label>Retirada prevista<input type="datetime-local" value={dataInicio} onChange={(event) => setDataInicio(event.target.value)} required /></label>
        <label>Devolução prevista<input type="datetime-local" value={dataDevolucao} min={dataInicio} onChange={(event) => setDataDevolucao(event.target.value)} required /></label>
        {filiaisRetirada.length > 0 && <label>Filial de retirada<select value={filialRetiradaId} required onChange={(event) => { const value = event.target.value; setFilialRetiradaId(value); if (!regrasLocacao.permiteDevolucaoOutraFilial) setFilialDevolucaoId(value); }}><option value="">Selecione a filial</option>{filiaisRetirada.map((filial) => <option key={filial.id} value={filial.id}>{filial.nome}</option>)}</select></label>}
        {filiaisDevolucao.length > 0 && <label>Filial de devolução<select value={filialDevolucaoId} required onChange={(event) => setFilialDevolucaoId(event.target.value)} disabled={!regrasLocacao.permiteDevolucaoOutraFilial}><option value="">Selecione a filial</option>{filiaisDevolucao.map((filial) => <option key={filial.id} value={filial.id}>{filial.nome}</option>)}</select></label>}
        <label>Cupom promocional (opcional)<input type="text" value={cupom} onChange={(event) => setCupom(event.target.value.toUpperCase())} maxLength={30} autoComplete="off" /></label>
        {Boolean(opcoes.convenios?.length) && <label>Convênio (se aplicável)<select value={convenioId} onChange={(event) => setConvenioId(event.target.value)}><option value="">Sem convênio</option>{opcoes.convenios.map((convenio) => <option key={convenio.id} value={convenio.id}>{convenio.nome}</option>)}</select></label>}
        <label>Forma de pagamento<select value={pagamento} onChange={(event) => setPagamento(event.target.value)}>{exigeCartaoCredito ? <option value="credito">Cartão de crédito</option> : <><option value="credito">Cartão de crédito</option><option value="debito">Cartão de débito</option><option value="pix">Pix</option><option value="boleto">Boleto</option><option value="dinheiro">Dinheiro</option><option value="faturado">Faturado</option></>}</select></label>
        {pagamento === "credito" && <label>Parcelas<input type="number" min="1" max={Number(taxaConfig.parcelamentoMax || 1)} step="1" value={parcelas} onChange={(event) => setParcelas(Number(event.target.value))} /></label>}
        {admin && <label>Origem da locação<select value={origem} onChange={(event) => setOrigem(event.target.value)}><option value="balcao">Balcão</option><option value="telefone">Telefone</option><option value="app">Aplicativo</option><option value="convenio">Convênio</option></select></label>}
      </div>

      {carregandoOpcoes && <p className="apoio">Carregando filiais, adicionais e proteções…</p>}
      {erroOpcoes && <p className="mensagem mensagem-erro" role="alert">{erroOpcoes}</p>}
      {regrasLocacao.kmLivre ? <p className="apoio">Quilometragem livre conforme regra vigente.</p> : <p className="apoio">Franquia incluída: {Number(regrasLocacao.kmFranquiaDiaria || 0) * (cotacao?.qtdDiarias || 0)} km estimados para o período; excedentes são apurados na devolução.</p>}

      {Boolean(opcoes.adicionais?.length) && <fieldset className="config-fieldset"><legend>Adicionais opcionais</legend><div className="grade-campos">{opcoes.adicionais.map((item) => <label className="config-check" key={item.id}><input type="checkbox" checked={adicionaisSelecionados.includes(item.id)} onChange={() => alternar(setAdicionaisSelecionados, adicionaisSelecionados, item.id)} />{item.nome} · {formatarMoeda(item.valor)} {item.tipoCobranca === "por_diaria" ? "por diária" : "por locação"}</label>)}</div></fieldset>}

      {Boolean(opcoes.protecoes?.length) && <fieldset className="config-fieldset"><legend>Proteções opcionais</legend><div className="grade-campos">{opcoes.protecoes.map((item) => <label className="config-check" key={item.id} title={item.descricao || undefined}><input type="checkbox" checked={protecoesSelecionadas.includes(item.id)} onChange={() => alternar(setProtecoesSelecionadas, protecoesSelecionadas, item.id)} />{item.nome} · {formatarMoeda(item.valorDiaria)} por diária</label>)}</div></fieldset>}

      {regrasLocacao.permiteMotoristaAdicional && Number(regrasLocacao.maxMotoristasAdicionais) > 0 && <fieldset className="config-fieldset"><legend>Motoristas adicionais (máximo {regrasLocacao.maxMotoristasAdicionais})</legend>{motoristas.map((motorista, index) => <div className="grade-campos" key={`motorista-${index}`}><label>Nome do motorista<input required minLength="2" maxLength="120" value={motorista.nome} onChange={(event) => atualizarMotorista(index, "nome", event.target.value)} /></label><label>CPF<input required inputMode="numeric" maxLength="14" value={motorista.cpf} onChange={(event) => atualizarMotorista(index, "cpf", event.target.value)} /></label><label>E-mail (opcional)<input type="email" maxLength="120" value={motorista.email} onChange={(event) => atualizarMotorista(index, "email", event.target.value)} /></label><label>Telefone (opcional)<input type="tel" maxLength="30" value={motorista.telefone} onChange={(event) => atualizarMotorista(index, "telefone", event.target.value)} /></label><button className="botao botao-secundario" type="button" onClick={() => setMotoristas((items) => items.filter((_, i) => i !== index))}>Remover motorista</button></div>)}{motoristas.length < Number(regrasLocacao.maxMotoristasAdicionais) && <button type="button" className="botao botao-secundario" onClick={() => setMotoristas((items) => [...items, { ...MOTORISTA_VAZIO }])}>Adicionar motorista</button>}</fieldset>}

      {veiculoId && <fieldset className="config-fieldset"><legend>Serviços e cobranças opcionais</legend><div className="grade-campos">
        {exibirTaxa("limpeza", "Taxa de limpeza", Number(taxaConfig.taxaLimpeza || 0))}
        {regrasLocacao.permiteRetiradaAeroporto && exibirTaxa("aeroporto", "Retirada no aeroporto", Number(taxaConfig.taxaAeroporto || 0))}
        {filialRetiradaId && filialDevolucaoId && Number(filialRetiradaId) !== Number(filialDevolucaoId) && <p className="apoio">Taxa de devolução em outra filial: {formatarMoeda(taxaConfig.taxaOutraFilial || 0)}.</p>}
        {regrasLocacao.permiteEntregaDomicilio && exibirTaxa("entregaDomicilio", `Entrega domiciliar + ${formatarMoeda(taxaConfig.taxaEntregaPorKm || 0)}/km`, Number(taxaConfig.taxaEntregaDomicilioFixa || 0))}
        {exibirTaxa("reporCombustivel", "Reposição de combustível", Number(taxaConfig.taxaReposicaoCombustivel || 0))}
      </div>
      {taxas.aeroporto && <label>Número do voo<input type="text" maxLength="10" value={vooNumero} onChange={(event) => setVooNumero(event.target.value)} required /></label>}
      {taxas.entregaDomicilio && <><label>Endereço de entrega<input type="text" maxLength="255" required value={enderecoEntrega} onChange={(event) => setEnderecoEntrega(event.target.value)} /></label><label>Endereço de coleta/devolução<input type="text" maxLength="255" required value={enderecoColeta} onChange={(event) => setEnderecoColeta(event.target.value)} /></label><label>Distância de entrega (km)<input type="number" min="0" max="9999.99" step="0.1" value={taxas.distanciaEntregaKm} onChange={(event) => atualizarTaxa("distanciaEntregaKm", event.target.value)} required /></label>{regrasLocacao.raioEntregaKm !== null && <span className="apoio">Raio máximo configurado: {regrasLocacao.raioEntregaKm} km.</span>}</>}
      {taxas.reporCombustivel && Number(taxaConfig.taxaCombustivelPorLitro || 0) > 0 && <label>Litros para estimativa<input type="number" min="0" step="0.1" value={taxas.litrosCombustivel} onChange={(event) => atualizarTaxa("litrosCombustivel", event.target.value)} /><span className="apoio">Valor por litro: {formatarMoeda(taxaConfig.taxaCombustivelPorLitro)}. Deixe zero para usar a taxa fixa.</span></label>}
      </fieldset>}

      <label>Observações da reserva<textarea maxLength="5000" rows="3" value={observacoes} onChange={(event) => setObservacoes(event.target.value)} /></label>
      <section className="cotacao-resumo" aria-live="polite"><h3>Estimativa da locação</h3>{cotando && <p className="apoio">Calculando com as regras vigentes…</p>}{erroCotacao && <p className="mensagem mensagem-erro" role="alert">{erroCotacao}</p>}
        {cotacao && <><dl className="cotacao-linhas"><div><dt>Diárias</dt><dd>{cotacao.qtdDiarias}</dd></div><div><dt>Diária média antes de descontos</dt><dd>{formatarMoeda(cotacao.valorDiariaAplicada)}</dd></div><div><dt>Subtotal de diárias</dt><dd>{formatarMoeda(cotacao.subtotalDiarias)}</dd></div>{Number(cotacao.totalAdicionais) > 0 && <div><dt>Adicionais e serviços</dt><dd>{formatarMoeda(cotacao.totalAdicionais)}</dd></div>}{Number(cotacao.totalProtecoes) > 0 && <div><dt>Proteções</dt><dd>{formatarMoeda(cotacao.totalProtecoes)}</dd></div>}{Number(cotacao.descontoTotal) > 0 && <div><dt>Descontos</dt><dd>− {formatarMoeda(cotacao.descontoTotal)}</dd></div>}{Number(cotacao.impostosTaxas) > 0 && <div><dt>Impostos e taxas</dt><dd>{formatarMoeda(cotacao.impostosTaxas)}</dd></div>}<div className="cotacao-total"><dt>Total estimado</dt><dd>{formatarMoeda(cotacao.valorTotal)}</dd></div></dl>
          <details className="cotacao-detalhes"><summary>Ver composição por item</summary><dl className="cotacao-linhas">{(cotacao.detalhes?.pacotes || []).map((item, index) => <div key={`pacote-${index}`}><dt>Tarifa {item.tipo} · {item.diarias} diária(s)</dt><dd>{formatarMoeda(item.subtotal)}</dd></div>)}{(cotacao.detalhes?.adicionais || []).map((item) => <div key={`adicional-${item.id}`}><dt>{item.nome} · {item.quantidade} ×</dt><dd>{formatarMoeda(item.total)}</dd></div>)}{(cotacao.detalhes?.taxasAdicionais || []).map((item, index) => <div key={`taxa-${index}`}><dt>{item.nome}</dt><dd>{formatarMoeda(item.total)}</dd></div>)}{(cotacao.detalhes?.protecoes || []).map((item) => <div key={`protecao-${item.protecaoId}`}><dt>{item.nome} · {cotacao.qtdDiarias} diária(s)</dt><dd>{formatarMoeda(item.total)}</dd></div>)}{Number(cotacao.detalhes?.descontoPromocao?.valor) > 0 && <div><dt>Desconto de cupom</dt><dd>− {formatarMoeda(cotacao.detalhes.descontoPromocao.valor)}</dd></div>}{Number(cotacao.detalhes?.descontoFidelidade?.valor) > 0 && <div><dt>Desconto de fidelidade</dt><dd>− {formatarMoeda(cotacao.detalhes.descontoFidelidade.valor)}</dd></div>}{Number(cotacao.detalhes?.impostos?.iss) > 0 && <div><dt>ISS</dt><dd>{formatarMoeda(cotacao.detalhes.impostos.iss)}</dd></div>}{Number(cotacao.detalhes?.impostos?.cartao) > 0 && <div><dt>Taxa de cartão</dt><dd>{formatarMoeda(cotacao.detalhes.impostos.cartao)}</dd></div>}{Number(cotacao.detalhes?.impostos?.jurosParcelamento) > 0 && <div><dt>Juros de parcelamento</dt><dd>{formatarMoeda(cotacao.detalhes.impostos.jurosParcelamento)}</dd></div>}</dl></details>
          {(cotacao.detalhes?.descontoPromocao?.limitadoPiso || cotacao.detalhes?.descontoFidelidade?.limitadoPiso) && <p className="apoio">O desconto foi limitado para preservar o custo mínimo e o piso de preço.</p>}{cotacao.valorCaucao !== null && <p className="apoio">Caução exigida: {formatarMoeda(cotacao.valorCaucao)} (garantia separada, não incluída no total).</p>}<p className="apoio">O valor é recalculado pela API ao confirmar a reserva; a cotação não bloqueia o veículo.</p></>}
        {!cotacao && !cotando && !erroCotacao && <p className="apoio">{admin && !clienteId ? "Selecione o cliente para consultar o preço personalizado." : "Selecione um veículo e as datas para consultar o preço vigente."}</p>}
      </section>
      <div className="acoes-formulario"><button type="submit" className="botao botao-principal" disabled={enviando || cotando || !cotacao || veiculos.length === 0}>{enviando ? "Registrando…" : "Confirmar reserva"}</button></div>
      {veiculos.length === 0 && <p className="apoio">Não há veículos disponíveis no momento.</p>}
    </form>
  );
}
