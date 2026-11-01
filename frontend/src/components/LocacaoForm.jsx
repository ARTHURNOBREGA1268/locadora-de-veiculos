import { useEffect, useRef, useState } from "react";
import { paraInputLocal, formatarMoeda } from "../utils/format";
import { mensagemDeErro } from "../services/api";
import * as precificacaoService from "../services/precificacaoService";

const VAZIO = { adicionais: [], protecoes: [], taxasDisponiveis: {}, valorCaucao: null };

export default function LocacaoForm({ veiculos, veiculoInicial, onSubmit }) {
  const [veiculoId, setVeiculoId] = useState(veiculoInicial || "");
  const [dataInicio, setDataInicio] = useState(() => paraInputLocal(new Date()));
  const [dataDevolucao, setDataDevolucao] = useState("");
  const [opcoes, setOpcoes] = useState(VAZIO);
  const [carregandoOpcoes, setCarregandoOpcoes] = useState(false);
  const [erroOpcoes, setErroOpcoes] = useState("");
  const [adicionaisSelecionados, setAdicionaisSelecionados] = useState([]);
  const [protecoesSelecionadas, setProtecoesSelecionadas] = useState([]);
  const [cupom, setCupom] = useState("");
  const [convenioId, setConvenioId] = useState("");
  const [pagamento, setPagamento] = useState("pix");
  const [parcelas, setParcelas] = useState(1);
  const [taxas, setTaxas] = useState({
    reporCombustivel: false,
    limpeza: false,
    aeroporto: false,
    outraFilial: false,
    entregaDomicilio: false,
    litrosCombustivel: "",
    distanciaEntregaKm: "",
  });
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
    if (!veiculoId) {
      setCarregandoOpcoes(false);
      return undefined;
    }
    let atual = true;
    setCarregandoOpcoes(true);
    precificacaoService.obterOpcoes(Number(veiculoId))
      .then((response) => { if (atual) setOpcoes(response); })
      .catch((error) => { if (atual) setErroOpcoes(mensagemDeErro(error)); })
      .finally(() => { if (atual) setCarregandoOpcoes(false); });
    return () => { atual = false; };
  }, [veiculoId]);

  function payloadCotacao() {
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
        outraFilial: Boolean(taxas.outraFilial),
        entregaDomicilio: Boolean(taxas.entregaDomicilio),
        distanciaEntregaKm: taxas.distanciaEntregaKm === "" ? 0 : Number(taxas.distanciaEntregaKm),
      },
      formaPagamento: pagamento,
      parcelas: pagamento === "cartao" ? Number(parcelas) : 1,
    };
    if (cupom.trim()) body.cupom = cupom.trim();
    if (convenioId) body.convenioId = Number(convenioId);
    return body;
  }

  useEffect(() => {
    if (!veiculoId || !dataInicio || !dataDevolucao || carregandoOpcoes || erroOpcoes) {
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
  }, [veiculoId, dataInicio, dataDevolucao, carregandoOpcoes, erroOpcoes, adicionaisSelecionados, protecoesSelecionadas, cupom, convenioId, pagamento, parcelas, taxas]);

  function alternar(setter, selecionados, id) {
    setter(selecionados.includes(id) ? selecionados.filter((value) => value !== id) : [...selecionados, id]);
  }
  function atualizarTaxa(campo, valor) {
    setTaxas((current) => ({ ...current, [campo]: valor }));
  }

  async function enviar(evento) {
    evento.preventDefault();
    if (!cotacao || cotando) return;
    setEnviando(true);
    try {
      const sucesso = await onSubmit(payloadCotacao());
      if (sucesso) {
        setVeiculoId("");
        setDataInicio(paraInputLocal(new Date()));
        setDataDevolucao("");
        setCupom("");
        setConvenioId("");
        setPagamento("pix");
        setParcelas(1);
        setTaxas({ reporCombustivel: false, limpeza: false, aeroporto: false, outraFilial: false, entregaDomicilio: false, litrosCombustivel: "", distanciaEntregaKm: "" });
      }
    } finally {
      setEnviando(false);
    }
  }

  const taxaConfig = opcoes.taxasDisponiveis || {};
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
        <label>
          Veículo disponível
          <select value={veiculoId} onChange={(event) => setVeiculoId(event.target.value)} required>
            <option value="">Selecione um veículo</option>
            {veiculos.map((veiculo) => <option key={veiculo.id} value={veiculo.id}>{veiculo.marca} {veiculo.modelo} — {veiculo.placa}</option>)}
          </select>
        </label>
        <label>Retirada<input type="datetime-local" value={dataInicio} onChange={(event) => setDataInicio(event.target.value)} required /></label>
        <label>Devolução prevista<input type="datetime-local" value={dataDevolucao} min={dataInicio} onChange={(event) => setDataDevolucao(event.target.value)} required /></label>
        <label>Cupom promocional (opcional)<input type="text" value={cupom} onChange={(event) => setCupom(event.target.value.toUpperCase())} maxLength={30} autoComplete="off" /></label>
        {Boolean(opcoes.convenios?.length) && <label>Convênio (se aplicável)<select value={convenioId} onChange={(event) => setConvenioId(event.target.value)}><option value="">Sem convênio</option>{opcoes.convenios.map((convenio) => <option key={convenio.id} value={convenio.id}>{convenio.nome}</option>)}</select></label>}
        <label>Forma de pagamento<select value={pagamento} onChange={(event) => setPagamento(event.target.value)}><option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option></select></label>
        {pagamento === "cartao" && <label>Parcelas<input type="number" min="1" max={Number(taxaConfig.parcelamentoMax || 1)} step="1" value={parcelas} onChange={(event) => setParcelas(Number(event.target.value))} /></label>}
      </div>

      {carregandoOpcoes && <p className="apoio">Carregando adicionais e proteções disponíveis…</p>}
      {erroOpcoes && <p className="mensagem mensagem-erro" role="alert">{erroOpcoes}</p>}

      {Boolean(opcoes.adicionais?.length) && (
        <fieldset className="config-fieldset">
          <legend>Adicionais opcionais</legend>
          <div className="grade-campos">
            {opcoes.adicionais.map((item) => (
              <label className="config-check" key={item.id}>
                <input type="checkbox" checked={adicionaisSelecionados.includes(item.id)} onChange={() => alternar(setAdicionaisSelecionados, adicionaisSelecionados, item.id)} />
                {item.nome} · {formatarMoeda(item.valor)} {item.tipoCobranca === "por_diaria" ? "por diária" : "por locação"}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {Boolean(opcoes.protecoes?.length) && (
        <fieldset className="config-fieldset">
          <legend>Proteções opcionais</legend>
          <div className="grade-campos">
            {opcoes.protecoes.map((item) => (
              <label className="config-check" key={item.id} title={item.descricao || undefined}>
                <input type="checkbox" checked={protecoesSelecionadas.includes(item.id)} onChange={() => alternar(setProtecoesSelecionadas, protecoesSelecionadas, item.id)} />
                {item.nome} · {formatarMoeda(item.valorDiaria)} por diária
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {veiculoId && (
        <fieldset className="config-fieldset">
          <legend>Serviços e cobranças opcionais</legend>
          <div className="grade-campos">
            {exibirTaxa("limpeza", "Taxa de limpeza", Number(taxaConfig.taxaLimpeza || 0))}
            {exibirTaxa("aeroporto", "Retirada no aeroporto", Number(taxaConfig.taxaAeroporto || 0))}
            {exibirTaxa("outraFilial", "Devolução em outra filial", Number(taxaConfig.taxaOutraFilial || 0))}
            {exibirTaxa("entregaDomicilio", `Entrega domiciliar + ${formatarMoeda(taxaConfig.taxaEntregaPorKm || 0)}/km`, Number(taxaConfig.taxaEntregaDomicilioFixa || 0))}
            {exibirTaxa("reporCombustivel", "Reposição de combustível", Number(taxaConfig.taxaReposicaoCombustivel || 0))}
          </div>
          {taxas.entregaDomicilio && <label>Distância de entrega (km)<input type="number" min="0" step="0.1" value={taxas.distanciaEntregaKm} onChange={(event) => atualizarTaxa("distanciaEntregaKm", event.target.value)} /></label>}
          {taxas.reporCombustivel && Number(taxaConfig.taxaCombustivelPorLitro || 0) > 0 && <label>Litros para estimativa<input type="number" min="0" step="0.1" value={taxas.litrosCombustivel} onChange={(event) => atualizarTaxa("litrosCombustivel", event.target.value)} /><span className="apoio">Valor por litro: {formatarMoeda(taxaConfig.taxaCombustivelPorLitro)}. Deixe zero para usar a taxa fixa.</span></label>}
        </fieldset>
      )}

      <section className="cotacao-resumo" aria-live="polite">
        <h3>Estimativa da locação</h3>
        {cotando && <p className="apoio">Calculando com as regras vigentes…</p>}
        {erroCotacao && <p className="mensagem mensagem-erro" role="alert">{erroCotacao}</p>}
        {cotacao && (
          <>
            <dl className="cotacao-linhas">
              <div><dt>Diárias</dt><dd>{cotacao.qtdDiarias}</dd></div>
              <div><dt>Diária média antes de descontos</dt><dd>{formatarMoeda(cotacao.valorDiariaAplicada)}</dd></div>
              <div><dt>Subtotal de diárias</dt><dd>{formatarMoeda(cotacao.subtotalDiarias)}</dd></div>
              {Number(cotacao.totalAdicionais) > 0 && <div><dt>Adicionais e serviços</dt><dd>{formatarMoeda(cotacao.totalAdicionais)}</dd></div>}
              {Number(cotacao.totalProtecoes) > 0 && <div><dt>Proteções</dt><dd>{formatarMoeda(cotacao.totalProtecoes)}</dd></div>}
              {Number(cotacao.descontoTotal) > 0 && <div><dt>Descontos</dt><dd>− {formatarMoeda(cotacao.descontoTotal)}</dd></div>}
              {Number(cotacao.impostosTaxas) > 0 && <div><dt>Impostos e taxas</dt><dd>{formatarMoeda(cotacao.impostosTaxas)}</dd></div>}
              <div className="cotacao-total"><dt>Total estimado</dt><dd>{formatarMoeda(cotacao.valorTotal)}</dd></div>
            </dl>
            <details className="cotacao-detalhes">
              <summary>Ver composição por item</summary>
              <dl className="cotacao-linhas">
                {(cotacao.detalhes?.pacotes || []).map((item, index) => <div key={`pacote-${index}`}><dt>Tarifa {item.tipo} · {item.diarias} diária(s)</dt><dd>{formatarMoeda(item.subtotal)}</dd></div>)}
                {(cotacao.detalhes?.adicionais || []).map((item) => <div key={`adicional-${item.id}`}><dt>{item.nome} · {item.quantidade} ×</dt><dd>{formatarMoeda(item.total)}</dd></div>)}
                {(cotacao.detalhes?.taxasAdicionais || []).map((item, index) => <div key={`taxa-${index}`}><dt>{item.nome}</dt><dd>{formatarMoeda(item.total)}</dd></div>)}
                {(cotacao.detalhes?.protecoes || []).map((item) => <div key={`protecao-${item.protecaoId}`}><dt>{item.nome} · {cotacao.qtdDiarias} diária(s)</dt><dd>{formatarMoeda(item.total)}</dd></div>)}
                {Number(cotacao.detalhes?.descontoPromocao?.valor) > 0 && <div><dt>Desconto de cupom</dt><dd>− {formatarMoeda(cotacao.detalhes.descontoPromocao.valor)}</dd></div>}
                {Number(cotacao.detalhes?.descontoFidelidade?.valor) > 0 && <div><dt>Desconto de fidelidade</dt><dd>− {formatarMoeda(cotacao.detalhes.descontoFidelidade.valor)}</dd></div>}
                {Number(cotacao.detalhes?.impostos?.iss) > 0 && <div><dt>ISS</dt><dd>{formatarMoeda(cotacao.detalhes.impostos.iss)}</dd></div>}
                {Number(cotacao.detalhes?.impostos?.cartao) > 0 && <div><dt>Taxa de cartão</dt><dd>{formatarMoeda(cotacao.detalhes.impostos.cartao)}</dd></div>}
                {Number(cotacao.detalhes?.impostos?.jurosParcelamento) > 0 && <div><dt>Juros de parcelamento</dt><dd>{formatarMoeda(cotacao.detalhes.impostos.jurosParcelamento)}</dd></div>}
              </dl>
            </details>
            {(cotacao.detalhes?.descontoPromocao?.limitadoPiso || cotacao.detalhes?.descontoFidelidade?.limitadoPiso) && <p className="apoio">O desconto foi limitado para preservar o custo mínimo e o piso de preço.</p>}
            {cotacao.valorCaucao !== null && <p className="apoio">Caução exigida: {formatarMoeda(cotacao.valorCaucao)} (garantia separada, não incluída no total).</p>}
            <p className="apoio">O valor é recalculado pela API ao confirmar a reserva; a cotação não bloqueia o veículo.</p>
          </>
        )}
        {!cotacao && !cotando && !erroCotacao && <p className="apoio">Selecione um veículo e as datas para consultar o preço vigente.</p>}
      </section>

      <div className="acoes-formulario">
        <button type="submit" className="botao botao-principal" disabled={enviando || cotando || !cotacao || veiculos.length === 0}>
          {enviando ? "Registrando…" : "Confirmar reserva"}
        </button>
      </div>
      {veiculos.length === 0 && <p className="apoio">Não há veículos disponíveis no momento.</p>}
    </form>
  );
}
