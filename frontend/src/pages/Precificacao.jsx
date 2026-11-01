import { useCallback, useEffect, useMemo, useState } from "react";
import * as service from "../services/precificacaoService";
import { mensagemDeErro } from "../services/api";
import Alert from "../components/Alert";
import { formatarDataHora, formatarMoeda } from "../utils/format";

const ABAS = [
  "Parâmetros e custos",
  "Tarifas e pisos",
  "Regras dinâmicas",
  "Adicionais",
  "Proteções",
  "Promoções",
  "Fidelidade",
  "Histórico",
];

const CONFIG_FIELDS = [
  ["ocupacaoAlvoPercentual", "Ocupação alvo (%)"],
  ["margemDesejadaPercentual", "Margem desejada (%)"],
  ["custoAdministrativoMensal", "Estrutura administrativa mensal por veículo (R$)"],
  ["kmMedioDiario", "Quilometragem média diária (km)", "1"],
  ["limpezaPorLocacao", "Limpeza por locação (R$)"],
  ["diasMediosLocacao", "Duração média (diárias)", "1"],
  ["comissaoPercentual", "Comissão (%)"],
  ["taxaPagamentoPercentual", "Taxas de pagamento (%)"],
  ["valorKmExcedente", "Valor do km excedente (R$)"],
  ["taxaReposicaoCombustivel", "Reposição de combustível (R$)"],
  ["taxaCombustivelPorLitro", "Combustível por litro (R$)"],
  ["taxaLimpeza", "Taxa de limpeza (R$)"],
  ["taxaAeroporto", "Taxa de aeroporto (R$)"],
  ["taxaOutraFilial", "Taxa de outra filial (R$)"],
  ["taxaEntregaDomicilioFixa", "Entrega domiciliar fixa (R$)"],
  ["taxaEntregaPorKm", "Entrega domiciliar por km (R$)"],
  ["atrasoToleranciaMinutos", "Tolerância de atraso (minutos)", "1"],
  ["atrasoValorHoraPercentual", "Atraso: percentual por hora (%)"],
  ["atrasoLimiteHorasViraDiaria", "Limite de atraso para nova diária (horas)", "1"],
  ["multaCancelamentoPercentual", "Multa de cancelamento (%)"],
  ["taxaAdminMultaTransito", "Taxa administrativa de multa (R$)"],
  ["issPercentual", "ISS (%)"],
  ["taxaCartaoPercentual", "Taxa de cartão (%)"],
  ["parcelamentoMax", "Parcelas máximas", "1"],
  ["parcelamentoJurosPercentual", "Juros no parcelamento (%)"],
  ["precoMinimoMargemPercentual", "Margem mínima de preço (%)"],
];
const CONFIG_KEYS = CONFIG_FIELDS.map(([key]) => key);
const CUSTO_FIELDS = [
  ["custoCapitalMensal", "Capital/financiamento mensal (R$)"],
  ["ipvaAnual", "IPVA anual (R$)"],
  ["seguroAnual", "Seguro anual (R$)"],
  ["licenciamentoAnual", "Licenciamento anual (R$)"],
  ["manutencaoPorKm", "Manutenção e pneus por km (R$)", "0.0001"],
];
const CUSTO_KEYS = CUSTO_FIELDS.map(([key]) => key);
const initialTarifa = () => ({
  categoriaId: "",
  valorDiaria: "",
  valorSemanal: null,
  valorMensal: null,
  vigenciaInicio: new Date().toISOString().slice(0, 10),
  vigenciaFim: null,
  ativo: true,
});
const INITIALS = {
  regras: {
    nome: "",
    tipo: "sazonalidade",
    categoriaId: null,
    dataInicio: "",
    dataFim: "",
    diasSemana: [],
    antecedenciaMinDias: null,
    antecedenciaMaxDias: null,
    ocupacaoMinPercentual: null,
    duracaoMinDiarias: null,
    tipoAjuste: "percentual",
    valorAjuste: 0,
    prioridade: 0,
    acumulavel: false,
    ativo: true,
  },
  adicionais: { nome: "", tipoCobranca: "por_diaria", valor: "", valorMaximoLocacao: null, ativo: true },
  protecoes: { protecaoId: "", categoriaId: null, valorDiaria: "", ativo: true },
  promocoes: {
    codigoCupom: "",
    descricao: "",
    tipoDesconto: "percentual",
    valorDesconto: "",
    vigenciaInicio: "",
    vigenciaFim: "",
    limiteUsosTotal: null,
    limiteUsosPorCliente: null,
    categoriaId: null,
    convenioId: null,
    acumulavel: false,
    ativo: true,
  },
  niveis: { nome: "", locacoesMinimas: 1, descontoPercentual: 0, ativo: true },
};
const META = {
  tarifas: {
    initial: initialTarifa,
    fields: [
      ["valorDiaria", "Diária (R$)", "number", { required: true, min: "0.01", step: "0.01" }],
      ["valorSemanal", "Pacote de 7 diárias (R$)", "number", { min: "0.01", step: "0.01" }],
      ["valorMensal", "Pacote de 30 diárias (R$)", "number", { min: "0.01", step: "0.01" }],
      ["vigenciaInicio", "Início da vigência", "date", { required: true }],
      ["vigenciaFim", "Fim da vigência", "date", {}],
    ],
    selects: [{ key: "categoriaId", label: "Categoria", required: true }],
    active: true,
    service: "tarifas",
  },
  regras: {
    initial: () => ({ ...INITIALS.regras }),
    fields: [
      ["nome", "Nome da regra", "text", { required: true, maxLength: 80 }],
      ["dataInicio", "Data inicial (sazonalidade)", "date", {}],
      ["dataFim", "Data final (sazonalidade)", "date", {}],
      ["antecedenciaMinDias", "Antecedência mínima (dias)", "number", { min: 0, step: 1 }],
      ["antecedenciaMaxDias", "Antecedência máxima (dias)", "number", { min: 0, step: 1 }],
      ["ocupacaoMinPercentual", "Ocupação mínima (%)", "number", { min: 0, max: 100, step: "0.01" }],
      ["duracaoMinDiarias", "Duração mínima (diárias)", "number", { min: 1, step: 1 }],
      ["valorAjuste", "Ajuste (%) ou (R$ por diária)", "number", { required: true, step: "0.01" }],
      ["prioridade", "Prioridade (menor aplica primeiro)", "number", { min: 0, max: 255, step: 1, required: true }],
    ],
    selects: [
      { key: "tipo", label: "Tipo de regra", required: true, options: [["sazonalidade", "Sazonalidade"], ["dia_semana", "Dia da semana"], ["antecedencia", "Antecedência"], ["ocupacao", "Ocupação"], ["duracao", "Duração"]] },
      { key: "categoriaId", label: "Categoria (vazio = todas)" },
      { key: "tipoAjuste", label: "Tipo de ajuste", required: true, options: [["percentual", "Percentual"], ["valor_fixo", "Valor fixo por diária"]] },
    ],
    active: true,
    accumulable: true,
    days: true,
    service: "regras",
  },
  adicionais: {
    initial: () => ({ ...INITIALS.adicionais }),
    fields: [
      ["nome", "Nome", "text", { required: true, maxLength: 80 }],
      ["valor", "Valor (R$)", "number", { required: true, min: 0, step: "0.01" }],
      ["valorMaximoLocacao", "Limite por locação (R$)", "number", { min: 0, step: "0.01" }],
    ],
    selects: [{ key: "tipoCobranca", label: "Cobrança", required: true, options: [["por_diaria", "Por diária"], ["por_locacao", "Uma vez por locação"]] }],
    active: true,
    service: "adicionais",
  },
  protecoes: {
    initial: () => ({ ...INITIALS.protecoes }),
    fields: [["valorDiaria", "Preço diário (R$)", "number", { required: true, min: 0, step: "0.01" }]],
    selects: [{ key: "protecaoId", label: "Proteção", required: true }, { key: "categoriaId", label: "Categoria (vazio = todas)" }],
    active: true,
    service: "protecoes",
  },
  promocoes: {
    initial: () => ({ ...INITIALS.promocoes }),
    fields: [
      ["codigoCupom", "Código do cupom", "text", { required: true, maxLength: 30 }],
      ["descricao", "Descrição", "text", { required: true, maxLength: 120 }],
      ["valorDesconto", "Desconto (%) ou (R$)", "number", { required: true, min: "0.01", step: "0.01" }],
      ["vigenciaInicio", "Início da vigência", "date", { required: true }],
      ["vigenciaFim", "Fim da vigência", "date", { required: true }],
      ["limiteUsosTotal", "Limite total de usos", "number", { min: 1, step: 1 }],
      ["limiteUsosPorCliente", "Limite de usos por cliente", "number", { min: 1, step: 1 }],
    ],
    selects: [
      { key: "tipoDesconto", label: "Tipo de desconto", required: true, options: [["percentual", "Percentual"], ["valor_fixo", "Valor fixo"]] },
      { key: "categoriaId", label: "Categoria (vazio = todas)" },
      { key: "convenioId", label: "Convênio (opcional)" },
    ],
    active: true,
    accumulable: true,
    service: "promocoes",
  },
  niveis: {
    initial: () => ({ ...INITIALS.niveis }),
    fields: [
      ["nome", "Nome", "text", { required: true, maxLength: 40 }],
      ["locacoesMinimas", "Locações mínimas", "number", { required: true, min: 1, max: 65535, step: 1 }],
      ["descontoPercentual", "Desconto (%)", "number", { required: true, min: 0, max: "99.99", step: "0.01" }],
    ],
    selects: [],
    active: true,
    service: "fidelidade",
  },
};

function InputFields({ fields, values, onChange }) {
  return (
    <div className="grade-campos">
      {fields.map(([key, label, type = "number", attrs = {}]) => (
        <label key={key}>
          {label}
          <input
            type={type}
            value={values[key] ?? ""}
            onChange={(event) => {
              const raw = event.target.value;
              const value = type === "number" ? (raw === "" ? null : Number(raw)) : raw;
              onChange(key, value);
            }}
            {...attrs}
          />
        </label>
      ))}
    </div>
  );
}

function SelectField({ label, value, onChange, options, required = false }) {
  return (
    <label>
      {label}
      <select
        required={required}
        value={value ?? ""}
        onChange={(event) => {
          const raw = event.target.value;
          onChange(raw === "" ? null : Number.isNaN(Number(raw)) ? raw : Number(raw));
        }}
      >
        <option value="">— Selecione —</option>
        {(options || []).map(([optionValue, text]) => (
          <option key={optionValue} value={optionValue}>{text}</option>
        ))}
      </select>
    </label>
  );
}

function Editor({ meta, initial, categories, protections, agreements, busy, onCancel, onSave }) {
  const [values, setValues] = useState(() => ({ ...meta.initial(), ...initial }));
  const change = (key, value) => setValues((current) => ({ ...current, [key]: value }));
  const selectOptions = (field) => {
    if (field.key === "categoriaId") return categories.map((item) => [item.id, item.nome]);
    if (field.key === "protecaoId") return protections.map((item) => [item.id, item.nome]);
    if (field.key === "convenioId") return agreements.map((item) => [item.id, item.nome]);
    return field.options || [];
  };
  function submit(event) {
    event.preventDefault();
    const payload = {};
    for (const [key] of meta.fields) payload[key] = values[key] ?? null;
    for (const field of meta.selects) payload[field.key] = values[field.key] ?? null;
    if (meta.active) payload.ativo = Boolean(values.ativo);
    if (meta.accumulable) payload.acumulavel = Boolean(values.acumulavel);
    if (meta.days) payload.diasSemana = values.diasSemana || [];
    onSave(payload);
  }
  return (
    <form className="formulario" onSubmit={submit}>
      <div className="grade-campos">
        {meta.selects.map((field) => (
          <SelectField
            key={field.key}
            label={field.label}
            value={values[field.key]}
            options={selectOptions(field)}
            required={field.required}
            onChange={(value) => change(field.key, value)}
          />
        ))}
      </div>
      {meta.days && (
        <fieldset className="config-fieldset">
          <legend>Dias da semana (para regra de dia da semana)</legend>
          <div className="grade-campos">
            {[[0, "Domingo"], [1, "Segunda"], [2, "Terça"], [3, "Quarta"], [4, "Quinta"], [5, "Sexta"], [6, "Sábado"]].map(([day, label]) => (
              <label className="config-check" key={day}>
                <input
                  type="checkbox"
                  checked={(values.diasSemana || []).includes(day)}
                  onChange={(event) => change("diasSemana", event.target.checked ? [...(values.diasSemana || []), day].sort() : (values.diasSemana || []).filter((item) => item !== day))}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <InputFields fields={meta.fields} values={values} onChange={change} />
      {meta.active && <label className="config-check"><input type="checkbox" checked={Boolean(values.ativo)} onChange={(event) => change("ativo", event.target.checked)} />Ativo</label>}
      {meta.accumulable && <label className="config-check"><input type="checkbox" checked={Boolean(values.acumulavel)} onChange={(event) => change("acumulavel", event.target.checked)} />Acumulável com outras regras/descontos</label>}
      <div className="acoes-formulario">
        <button className="botao botao-principal" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</button>
        <button type="button" className="botao botao-secundario" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}

function Card({ title, children }) {
  return <section className="painel config-secao"><h2>{title}</h2><div className="config-corpo">{children}</div></section>;
}

function ListaRegistros({ items, titulo, detalhe, onEdit, onInactivate }) {
  const [filtro, setFiltro] = useState("");
  const [situacao, setSituacao] = useState("todos");
  const visiveis = items.filter((item) => {
    const texto = [item.nome, item.descricao, item.codigoCupom, item.protecao?.nome, item.categoria?.nome, item.tipo, item.valorDiaria, item.valor].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
    return texto.includes(filtro.trim().toLocaleLowerCase("pt-BR")) && (situacao === "todos" || (situacao === "ativos" ? item.ativo : !item.ativo));
  });
  return (
    <div className="tabela-usuarios-scroll">
      <div className="precificacao-filtros">
        <label>Buscar<input type="search" value={filtro} onChange={(event) => setFiltro(event.target.value)} placeholder={`Buscar em ${titulo.toLowerCase()}…`} /></label>
        <label>Situação<select value={situacao} onChange={(event) => setSituacao(event.target.value)}><option value="todos">Todas</option><option value="ativos">Ativos</option><option value="inativos">Inativos</option></select></label>
      </div>
      <table className="tabela-usuarios config-tabela">
        <thead><tr><th>{titulo}</th><th>Detalhes</th><th>Situação</th><th>Ações</th></tr></thead>
        <tbody>
          {visiveis.map((item) => (
            <tr key={item.id}>
              <td data-label={titulo}>{item.nome || item.descricao || item.codigoCupom || item.protecao?.nome || `Registro ${item.id}`}</td>
              <td data-label="Detalhes">{detalhe(item)}</td>
              <td data-label="Situação">{item.ativo ? "Ativo" : "Inativo"}</td>
              <td data-label="Ações">
                <button type="button" className="botao botao-secundario" onClick={() => onEdit(item)}>Editar</button>
                {item.ativo && <button type="button" className="botao botao-secundario" onClick={() => onInactivate(item)}>Inativar</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
          {!items.length && <p className="apoio">Nenhum registro cadastrado.</p>}
          {items.length > 0 && !visiveis.length && <p className="apoio">Nenhum registro corresponde aos filtros.</p>}
    </div>
  );
}

function Historico({ rows }) {
  return (
    <div className="tabela-usuarios-scroll">
      <table className="tabela-usuarios config-tabela">
        <thead><tr><th>Quando</th><th>Origem</th><th>Registro</th><th>Campo</th><th>Anterior</th><th>Novo</th><th>Usuário</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id}><td>{row.alteradoEm ? formatarDataHora(row.alteradoEm) : "—"}</td><td>{row.tabelaOrigem}</td><td>{row.registroId}</td><td>{row.campo}</td><td>{row.valorAnterior ?? "—"}</td><td>{row.valorNovo ?? "—"}</td><td>{row.usuario?.nome || row.usuario?.email || "—"}</td></tr>)}</tbody>
      </table>
      {!rows.length && <p className="apoio">Nenhuma alteração registrada.</p>}
    </div>
  );
}

function rowDetails(kind, item) {
  if (kind === "tarifasBase") return `${formatarMoeda(item.valorDiaria)} / diária · ${String(item.vigenciaInicio).slice(0, 10)} a ${item.vigenciaFim ? String(item.vigenciaFim).slice(0, 10) : "sem fim"}`;
  if (kind === "regras") return `${item.tipo} · ${item.tipoAjuste === "percentual" ? `${item.valorAjuste}%` : `${formatarMoeda(item.valorAjuste)} por diária`} · prioridade ${item.prioridade}`;
  if (kind === "adicionais") return `${formatarMoeda(item.valor)} · ${item.tipoCobranca === "por_diaria" ? "por diária" : "por locação"}`;
  if (kind === "protecoes") return `${item.categoria?.nome || "Todas as categorias"} · ${formatarMoeda(item.valorDiaria)}/dia`;
  if (kind === "promocoes") return `${item.tipoDesconto === "percentual" ? `${item.valorDesconto}%` : formatarMoeda(item.valorDesconto)} · usos: ${item.usosRealizados ?? 0} (somente leitura)`;
  if (kind === "niveisFidelidade") return `${item.locacoesMinimas} locações · ${item.descontoPercentual}%`;
  return "—";
}

export default function Precificacao() {
  const [dados, setDados] = useState(null);
  const [aba, setAba] = useState(0);
  const [edicao, setEdicao] = useState(null);
  const [alerta, setAlerta] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [configDraft, setConfigDraft] = useState({});
  const [custosDraft, setCustosDraft] = useState({});

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const response = await service.obterAdmin();
      setDados(response);
      setConfigDraft(response.configuracao || {});
      setCustosDraft(Object.fromEntries((response.veiculos || []).map((vehicle) => [vehicle.id, { ...(vehicle.custosPrecificacao || {}) }])));
    } catch (error) {
      setAlerta({ tipo: "erro", texto: mensagemDeErro(error) });
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const categorias = dados?.categorias || [];
  const opcoesCategorias = useMemo(() => categorias.map((item) => [item.id, item.nome]), [categorias]);
  const catalogoProtecoes = dados?.catalogoProtecoes || [];
  const opcoesProtecoes = useMemo(() => catalogoProtecoes.map((item) => [item.id, item.nome]), [catalogoProtecoes]);
  const opcoesConvenios = useMemo(() => (dados?.convenios || []).filter((item) => item.ativo).map((item) => [item.id, item.nome]), [dados]);

  async function executar(operacao, sucesso) {
    setAlerta(null);
    setSalvando(true);
    try {
      await operacao();
      setAlerta({ tipo: "sucesso", texto: sucesso });
      setEdicao(null);
      await carregar();
    } catch (error) {
      setAlerta({ tipo: "erro", texto: mensagemDeErro(error) });
    } finally {
      setSalvando(false);
    }
  }

  function iniciarEdicao(tipo, item = null) {
    const meta = META[tipo];
    const base = typeof meta.initial === "function" ? meta.initial() : { ...meta.initial };
    const initial = item ? { ...base, ...item } : base;
    for (const [key] of meta.fields) {
      const field = meta.fields.find((entry) => entry[0] === key);
      if (field?.[2] === "date" && initial[key]) initial[key] = String(initial[key]).slice(0, 10);
    }
    setEdicao({ tipo, id: item?.id ?? null, initial });
  }

  const salvarRegistro = (tipo, payload) => {
    const meta = META[tipo];
    const resource = service[meta.service];
    return executar(
      () => edicao?.id ? resource.atualizar(edicao.id, payload) : resource.criar(payload),
      `${tipo === "tarifas" ? "Tarifa" : tipo === "regras" ? "Regra" : "Registro"} salvo com sucesso.`,
    );
  };

  if (carregando) return <p className="carregando-pagina">Carregando precificação…</p>;
  if (!dados) return <><Alert alerta={alerta} onFechar={() => setAlerta(null)} /><button type="button" className="botao botao-secundario" onClick={carregar}>Tentar novamente</button></>;

  const tarifas = dados.tarifasBase || [];
  const regras = dados.regras || [];
  const adicionais = dados.adicionais || [];
  const protecoes = dados.protecoes || [];
  const promocoes = dados.promocoes || [];
  const niveis = dados.niveisFidelidade || [];

  function renderCadastro(tipo, lista, label) {
    const meta = META[tipo];
    const recurso = service[meta.service];
    return (
      <>
        <Card title={label}>
          {edicao?.tipo === tipo ? (
            <Editor
              key={`${tipo}-${edicao.id ?? "novo"}`}
              meta={meta}
              initial={edicao.initial}
              categories={opcoesCategorias.map(([id, nome]) => ({ id, nome }))}
              protections={catalogoProtecoes}
              agreements={opcoesConvenios.map(([id, nome]) => ({ id, nome }))}
              busy={salvando}
              onCancel={() => setEdicao(null)}
              onSave={(payload) => salvarRegistro(tipo, payload)}
            />
          ) : (
            <button type="button" className="botao botao-principal" onClick={() => iniciarEdicao(tipo)}>Adicionar</button>
          )}
          <ListaRegistros
            items={lista}
            titulo={label}
            detalhe={(item) => rowDetails(tipo === "niveis" ? "niveisFidelidade" : tipo, item)}
            onEdit={(item) => iniciarEdicao(tipo, item)}
            onInactivate={(item) => executar(() => recurso.atualizar(item.id, { ativo: false }), "Registro inativado. O histórico foi preservado.")}
          />
        </Card>
      </>
    );
  }

  const views = [
    <>
      <Card title="Parâmetros de custo e cobranças">
        <p className="apoio">Informe dados reais conhecidos. Campos de custo vazios permanecem incompletos e não são tratados como zero pelo cálculo recomendado.</p>
        <form className="formulario" onSubmit={(event) => {
          event.preventDefault();
          const payload = Object.fromEntries(CONFIG_KEYS.map((key) => [key, configDraft[key] ?? null]));
          executar(() => service.salvarConfiguracao(payload), "Parâmetros de precificação salvos.");
        }}>
          <InputFields fields={CONFIG_FIELDS.map(([key, label, step]) => [key, label, "number", { min: 0, step: step || "0.01" }])} values={configDraft} onChange={(key, value) => setConfigDraft((current) => ({ ...current, [key]: value }))} />
          <button className="botao botao-principal" disabled={salvando}>Salvar parâmetros</button>
        </form>
      </Card>
      <Card title="Custos por veículo">
        <p className="apoio">Custos sem valor conhecido ficam vazios. A diária mínima recomendada usa somente cadastros completos.</p>
        {(dados.veiculos || []).map((vehicle) => {
          const cost = vehicle.recomendacaoCusto;
          return (
            <form key={vehicle.id} className="painel config-secao" onSubmit={(event) => {
              event.preventDefault();
              const payload = Object.fromEntries(Object.entries(custosDraft[vehicle.id] || {}).filter(([key, value]) => CUSTO_KEYS.includes(key) && value !== null && value !== "" && value !== undefined));
              if (!Object.keys(payload).length) {
                setAlerta({ tipo: "erro", texto: "Informe ao menos um custo para salvar." });
                return;
              }
              executar(() => service.salvarCustos(vehicle.id, payload), `Custos do veículo ${vehicle.placa} salvos.`);
            }}>
              <h3>{vehicle.marca} {vehicle.modelo} — {vehicle.placa} · {vehicle.categoria?.nome}</h3>
              <p><strong>Diária mínima recomendada: </strong>{cost?.completo ? formatarMoeda(cost.diariaMinima) : "pendente de dados completos"}</p>
              {cost?.completo && <p className="apoio">Custo antes da ocupação: {formatarMoeda(cost.componentes.custoDiarioOperacional)} · custo por diária alugada: {formatarMoeda(cost.componentes.custoPorDiariaAlugada)}.</p>}
              <InputFields
                fields={CUSTO_FIELDS.map(([key, label, step]) => [key, label, "number", { min: 0, step: step || "0.01" }])}
                values={custosDraft[vehicle.id] || {}}
                onChange={(key, value) => setCustosDraft((current) => ({ ...current, [vehicle.id]: { ...current[vehicle.id], [key]: value } }))}
              />
              <button className="botao botao-secundario" disabled={salvando}>Salvar custos</button>
            </form>
          );
        })}
      </Card>
    </>,
    <>
      <Card title="Tarifas base por categoria">
        {edicao?.tipo === "tarifas" ? (
          <Editor key={`tarifas-${edicao.id ?? "novo"}`} meta={META.tarifas} initial={edicao.initial} categories={categorias} protections={catalogoProtecoes} agreements={[]} busy={salvando} onCancel={() => setEdicao(null)} onSave={(payload) => salvarRegistro("tarifas", payload)} />
        ) : <button type="button" className="botao botao-principal" onClick={() => iniciarEdicao("tarifas")}>Nova tarifa</button>}
        <ListaRegistros items={tarifas} titulo="Tarifa" detalhe={(item) => rowDetails("tarifasBase", item)} onEdit={(item) => iniciarEdicao("tarifas", item)} onInactivate={(item) => executar(() => service.tarifas.atualizar(item.id, { ativo: false }), "Tarifa inativada. O histórico foi preservado.")} />
      </Card>
      <Card title="Piso mínimo por categoria">
        <div className="grade-campos">
          {categorias.map((category) => {
            const floor = (dados.pisosCategoria || []).find((item) => item.categoriaId === category.id);
            return <form className="formulario" key={category.id} onSubmit={(event) => {
              event.preventDefault();
              const value = event.currentTarget.elements.valor.value;
              executar(() => service.salvarPiso(category.id, value), `Piso de ${category.nome} salvo.`);
            }}>
              <label>{category.nome} — piso mínimo (R$)<input name="valor" type="number" min="0" step="0.01" defaultValue={floor?.valor ?? ""} required /></label>
              <button className="botao botao-secundario" disabled={salvando}>Salvar piso</button>
            </form>;
          })}
        </div>
      </Card>
    </>,
    renderCadastro("regras", regras, "Regras dinâmicas"),
    renderCadastro("adicionais", adicionais, "Adicionais"),
    renderCadastro("protecoes", protecoes, "Preços de proteções"),
    renderCadastro("promocoes", promocoes, "Promoções"),
    renderCadastro("niveis", niveis, "Níveis de fidelidade"),
    <Card title="Histórico de alterações de preço"><Historico rows={dados.historico || []} /></Card>,
  ];

  return (
    <>
      <div className="cabecalho-pagina">
        <p className="frota-eyebrow">ADMINISTRAÇÃO</p>
        <h1>Precificação</h1>
        <p className="apoio">Configure o custo mínimo por veículo, as tarifas vigentes e os fatores que compõem o preço final. A API calcula e confirma o valor.</p>
      </div>
      <Alert alerta={alerta} onFechar={() => setAlerta(null)} />
      <div role="tablist" aria-label="Seções de precificação" className="precificacao-abas">
        {ABAS.map((label, index) => <button type="button" role="tab" aria-selected={aba === index} key={label} className={`botao ${aba === index ? "botao-principal" : "botao-secundario"}`} onClick={() => { setAba(index); setEdicao(null); }}>{label}</button>)}
      </div>
      {views[aba]}
    </>
  );
}
