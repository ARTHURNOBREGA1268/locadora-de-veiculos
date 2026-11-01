import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../context/AuthContext";
import * as veiculoService from "../services/veiculoService";
import { mensagemDeErro } from "../services/api";
import Alert from "../components/Alert";
import { formatarMoeda } from "../utils/format";

const filtros = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "disponivel", rotulo: "Disponíveis" },
  { valor: "alugado", rotulo: "Alugados" },
  { valor: "reservado", rotulo: "Reservados" },
  { valor: "manutencao", rotulo: "Em manutenção" },
  { valor: "inativo", rotulo: "Inativos" },
];
const statusNome = {
  disponivel: "Disponível",
  alugado: "Alugado",
  reservado: "Reservado",
  manutencao: "Em manutenção",
  inativo: "Inativo",
};
const enumNomes = {
  reservada: "Reservada",
  retirada: "Retirada",
  devolvida: "Devolvida",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
  manual: "Manual",
  automatico: "Automático",
  gasolina: "Gasolina",
  etanol: "Etanol",
  flex: "Flex",
  diesel: "Diesel",
  eletrico: "Elétrico",
  hibrido: "Híbrido",
  a_vista: "À vista",
  financiado: "Financiado",
  leasing: "Leasing",
  aberto: "Aberto",
  em_andamento: "Em andamento",
  resolvido: "Resolvido",
  pendente: "Pendente",
  paga: "Paga",
  contestada: "Contestada",
  saida: "Saída",
  entrada: "Entrada",
};
const tipos = {
  manutencoes: {
    titulo: "Manutenção",
    campos: [
      ["data", "Data", "date", true],
      ["tipo", "Tipo", "text", true],
      ["descricao", "Descrição", "text", true],
      ["valor", "Valor", "number", true],
      ["km", "Quilometragem (km)", "number", true],
    ],
  },
  sinistrosAvarias: {
    titulo: "Sinistro / avaria",
    campos: [
      ["data", "Data", "date", true],
      ["descricao", "Descrição", "text", true],
      ["valorReparo", "Valor do reparo", "number", true],
      [
        "status",
        "Status",
        "select",
        ["aberto", "em_andamento", "resolvido"],
        true,
      ],
    ],
  },
  multas: {
    titulo: "Multa",
    campos: [
      ["data", "Data e hora", "datetime-local", true],
      ["infracao", "Infração", "text", true],
      ["valor", "Valor", "number", true],
      ["status", "Status", "select", ["pendente", "paga", "contestada"], true],
      ["locacaoId", "Locação vinculada (opcional)", "locacao"],
    ],
  },
  vistorias: {
    titulo: "Vistoria",
    campos: [
      ["data", "Data e hora", "datetime-local", true],
      ["tipo", "Tipo", "select", ["saida", "entrada"], true],
      ["km", "Quilometragem (km)", "number", true],
      ["nivelCombustivel", "Nível de combustível (%)", "number", true],
      ["observacoes", "Observações", "text", true],
      ["locacaoId", "Locação vinculada (opcional)", "locacao"],
    ],
  },
};
const opcionaisSugeridos = [
  "ar_condicionado",
  "direcao_eletrica",
  "direcao_hidraulica",
  "airbag",
  "abs",
  "camera_re",
  "sensor_estacionamento",
  "multimidia",
  "bancos_couro",
  "vidros_eletricos",
  "trava_eletrica",
  "controle_cruzeiro",
];
const secoes = [
  [
    "Identificação",
    [
      ["placa", "Placa", "text", true],
      ["renavam", "RENAVAM", "text"],
      ["chassi", "Chassi", "text"],
      ["marca", "Marca", "text", true],
      ["modelo", "Modelo", "text", true],
      ["versao", "Versão", "text"],
      ["anoFabricacao", "Ano de fabricação", "number", true],
      ["anoModelo", "Ano do modelo", "number", true],
      ["cor", "Cor", "color", false],
      ["categoriaId", "Categoria", "category", true],
    ],
  ],
  [
    "Características",
    [
      ["cambio", "Câmbio", "select", ["manual", "automatico"], true],
      [
        "combustivel",
        "Combustível",
        "select",
        ["gasolina", "etanol", "flex", "diesel", "eletrico", "hibrido"],
        true,
      ],
      ["motor", "Motor", "text"],
      ["numPortas", "Número de portas", "number", true],
      ["numPassageiros", "Passageiros", "number", true],
      ["capacidadePortaMalas", "Porta-malas (L)", "number"],
    ],
  ],
  [
    "Dados financeiros",
    [
      ["dataCompra", "Data da compra", "date"],
      ["valorCompra", "Valor de compra", "number"],
      [
        "formaAquisicao",
        "Forma de aquisição",
        "select",
        ["a_vista", "financiado", "leasing"],
      ],
      ["valorFipe", "Valor FIPE", "number"],
      ["valorRevendaEstimado", "Revenda estimada", "number"],
      ["vidaUtilMeses", "Vida útil (meses)", "number"],
    ],
  ],
  [
    "Documentação",
    [
      ["crlvVencimento", "Vencimento CRLV", "date"],
      ["ipvaVencimento", "Vencimento IPVA", "date"],
      ["licenciamentoVencimento", "Vencimento licenciamento", "date"],
      ["seguradora", "Seguradora", "text"],
      ["apoliceNumero", "Número da apólice", "text"],
      ["apoliceVencimento", "Vencimento da apólice", "date"],
      ["apoliceFranquia", "Franquia", "number"],
    ],
  ],
  [
    "Operacional",
    [
      [
        "status",
        "Status",
        "select",
        ["disponivel", "alugado", "reservado", "manutencao", "inativo"],
        true,
      ],
      ["kmAtual", "Quilometragem atual", "number"],
      ["nivelCombustivel", "Combustível (%)", "range"],
      ["filialId", "Filial", "branch", true],
      ["proximaRevisaoKm", "Próxima revisão (km)", "number"],
      ["proximaRevisaoData", "Próxima revisão (data)", "date"],
    ],
  ],
];
const nome = (v) =>
  enumNomes[v] ||
  String(v || "")
    .replaceAll("_", " ")
    .replace(/^./, (c) => c.toUpperCase());
const dateInput = (value) => (value ? String(value).slice(0, 10) : "");
const dateTimeInput = (value) => (value ? String(value).slice(0, 16) : "");
const dataHoraLegivel = (value) =>
  value
    ? new Date(value).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";
const toIso = (value) => (value ? new Date(value).toISOString() : value);
const labelCampo = (key) =>
  ({
    km: "Quilometragem (km)",
    nivelCombustivel: "Nível de combustível (%)",
    valorReparo: "Valor do reparo",
  })[key] || nome(key);

function Campo({ campo, valor, onChange, metadados }) {
  const [key, label, type, options, required = false] = campo;
  const opts = Array.isArray(options) ? options : [];
  const comum = {
    id: key,
    name: key,
    value: type === "date" ? dateInput(valor) : (valor ?? ""),
    onChange: (e) => {
      let value = e.target.value;
      if (key === "placa")
        value = value
          .replace(/[^a-z\d]/gi, "")
          .toUpperCase()
          .slice(0, 7);
      if (key === "renavam") value = value.replace(/\D/g, "").slice(0, 11);
      if (key === "chassi")
        value = value
          .toUpperCase()
          .replace(/[^A-HJ-NPR-Z0-9]/g, "")
          .slice(0, 17);
      onChange(key, value);
    },
    required: required || options === true,
    maxLength:
      { placa: 7, renavam: 11, chassi: 17, marca: 50, modelo: 80, versao: 80 }[
        key
      ] || 120,
  };
  let conteudo;
  if (type === "select")
    conteudo = (
      <select {...comum}>
        <option value="">Selecione</option>
        {opts.map((o) => (
          <option key={o} value={o}>
            {nome(o)}
          </option>
        ))}
      </select>
    );
  else if (type === "color")
    conteudo = (
      <select {...comum}>
        <option value="">Selecione</option>
        {[
          "Branco",
          "Preto",
          "Prata",
          "Cinza",
          "Vermelho",
          "Azul",
          "Verde",
          "Amarelo",
          "Marrom",
          "Outra",
        ].map((c) => (
          <option key={c} value={c.toLowerCase()}>
            {c}
          </option>
        ))}
      </select>
    );
  else if (type === "category" || type === "branch") {
    const lista =
      type === "category"
        ? metadados.categorias || []
        : metadados.filiais || [];
    conteudo = (
      <select {...comum}>
        <option value="">Selecione</option>
        {lista.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nome || o.descricao || o.nomeFantasia || `#${o.id}`}
          </option>
        ))}
      </select>
    );
  } else if (key === "marca")
    conteudo = (
      <>
        <input {...comum} list="marcas-veiculos" />
        <datalist id="marcas-veiculos">
          {[
            "Chevrolet",
            "Fiat",
            "Ford",
            "Honda",
            "Hyundai",
            "Jeep",
            "Nissan",
            "Renault",
            "Toyota",
            "Volkswagen",
          ].map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </>
    );
  else
    conteudo = (
      <>
        <input
          {...comum}
          type={type}
          min={type === "number" || type === "range" ? 0 : undefined}
          max={
            key === "nivelCombustivel"
              ? 100
              : ["anoFabricacao", "anoModelo"].includes(key)
                ? 2100
                : key === "numPortas"
                  ? 8
                  : key === "numPassageiros"
                    ? 100
                    : undefined
          }
          step={
            [
              "valorCompra",
              "valorFipe",
              "valorRevendaEstimado",
              "apoliceFranquia",
            ].includes(key)
              ? "0.01"
              : "1"
          }
          maxLength={type === "text" ? comum.maxLength : undefined}
        />
        {type === "range" && (
          <output aria-live="polite">{Number(valor || 0)}%</output>
        )}
      </>
    );
  return (
    <label htmlFor={key}>
      {label}
      {conteudo}
    </label>
  );
}

function Modal({ titulo, fechar, children, largo = false }) {
  useEffect(() => {
    const fn = (e) => {
      if (e.key === "Escape") fechar();
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [fechar]);
  return (
    <div
      className="frota-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) fechar();
      }}
    >
      <section
        className={`frota-modal ${largo ? "frota-modal-largo" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal"
      >
        <header>
          <h2 id="titulo-modal">{titulo}</h2>
          <button
            type="button"
            className="frota-fechar"
            aria-label="Fechar janela"
            onClick={fechar}
          >
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export default function Veiculos() {
  const { usuario } = useAuth();
  const admin = usuario?.papel === "ADMIN";
  const [veiculos, setVeiculos] = useState([]),
    [filtro, setFiltro] = useState("todos"),
    [carregando, setCarregando] = useState(true),
    [alerta, setAlerta] = useState(null);
  const [metadados, setMetadados] = useState({
    categorias: [],
    filiais: [],
    opcionais: [],
  });
  const [modal, setModal] = useState(null),
    [form, setForm] = useState({}),
    [salvando, setSalvando] = useState(false),
    [historico, setHistorico] = useState(null),
    [tipoHistorico, setTipoHistorico] = useState("manutencoes");
  const [locacoes, setLocacoes] = useState([]);
  const [carregandoLocacoes, setCarregandoLocacoes] = useState(false);
  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setVeiculos(
        await veiculoService.listar(
          filtro === "todos" ? {} : { status: filtro },
        ),
      );
    } catch (e) {
      setAlerta({ tipo: "erro", texto: mensagemDeErro(e) });
    } finally {
      setCarregando(false);
    }
  }, [filtro]);
  useEffect(() => {
    carregar();
  }, [carregar]);
  useEffect(() => {
    if (admin)
      veiculoService
        .metadados()
        .then((d) =>
          setMetadados({
            categorias: d.categorias || [],
            filiais: d.filiais || [],
            opcionais: d.opcionais || [],
          }),
        )
        .catch(() => {});
  }, [admin]);
  const opcionais = useMemo(
    () =>
      metadados.opcionais.filter(
        (o) => o && typeof o === "object" && Number.isFinite(Number(o.id)),
      ),
    [metadados],
  );
  function normalizarForm(item = {}) {
    return {
      ...item,
      dataCompra: dateInput(item.dataCompra),
      proximaRevisaoData: dateInput(item.proximaRevisaoData),
      crlvVencimento: dateInput(item.crlvVencimento),
      ipvaVencimento: dateInput(item.ipvaVencimento),
      licenciamentoVencimento: dateInput(item.licenciamentoVencimento),
      apoliceVencimento: dateInput(item.apoliceVencimento),
      categoriaId: item.categoriaId ?? item.categoria?.id ?? "",
      filialId: item.filialId ?? item.filial?.id ?? "",
      opcionais: (item.opcionais || [])
        .map((o) =>
          Number(typeof o === "object" ? (o.opcional?.id ?? o.id) : o),
        )
        .filter(Number.isFinite),
    };
  }
  function abrirCadastro(item) {
    setForm(item ? normalizarForm(item) : { status: "inativo", opcionais: [] });
    setModal(item ? "editar" : "novo");
  }
  async function editarVeiculo(item) {
    try {
      setForm(normalizarForm(await veiculoService.obter(item.id)));
      setModal("editar");
    } catch (e) {
      setAlerta({ tipo: "erro", texto: mensagemDeErro(e) });
    }
  }
  async function salvarVeiculo(e) {
    e.preventDefault();
    setSalvando(true);
    setAlerta(null);
    const camposEditaveis = [
      "placa",
      "renavam",
      "chassi",
      "marca",
      "modelo",
      "versao",
      "anoFabricacao",
      "anoModelo",
      "cor",
      "categoriaId",
      "cambio",
      "combustivel",
      "motor",
      "numPortas",
      "numPassageiros",
      "capacidadePortaMalas",
      "opcionais",
      "dataCompra",
      "valorCompra",
      "formaAquisicao",
      "valorFipe",
      "valorRevendaEstimado",
      "vidaUtilMeses",
      "crlvVencimento",
      "ipvaVencimento",
      "licenciamentoVencimento",
      "seguradora",
      "apoliceNumero",
      "apoliceVencimento",
      "apoliceFranquia",
      "status",
      "kmAtual",
      "nivelCombustivel",
      "filialId",
      "proximaRevisaoKm",
      "proximaRevisaoData",
    ];
    const payload = Object.fromEntries(
      camposEditaveis
        .filter(
          (k) => form[k] !== undefined && form[k] !== null && form[k] !== "",
        )
        .map((k) => [k, form[k]]),
    );
    payload.categoriaId = Number(form.categoriaId);
    payload.filialId = Number(form.filialId);
    payload.opcionais = (form.opcionais || []).map(Number);
    [
      "anoFabricacao",
      "anoModelo",
      "kmAtual",
      "nivelCombustivel",
      "numPortas",
      "numPassageiros",
      "capacidadePortaMalas",
      "vidaUtilMeses",
      "proximaRevisaoKm",
    ].forEach((k) => {
      if (payload[k] !== "" && payload[k] != null)
        payload[k] = Number(payload[k]);
    });
    [
      "valorCompra",
      "valorFipe",
      "valorRevendaEstimado",
      "apoliceFranquia",
    ].forEach((k) => {
      if (payload[k] !== "" && payload[k] != null)
        payload[k] = Number(payload[k]);
    });
    [
      "dataCompra",
      "proximaRevisaoData",
      "crlvVencimento",
      "ipvaVencimento",
      "licenciamentoVencimento",
      "apoliceVencimento",
    ].forEach((k) => {
      if (payload[k]) payload[k] = toIso(payload[k]);
    });
    try {
      const result =
        modal === "editar"
          ? await veiculoService.atualizar(form.id, payload)
          : await veiculoService.cadastrar(payload);
      setAlerta({
        tipo: "sucesso",
        texto: `${result.marca || form.marca} ${result.modelo || form.modelo} salvo com sucesso.`,
      });
      setModal(null);
      await carregar();
    } catch (err) {
      setAlerta({ tipo: "erro", texto: mensagemDeErro(err) });
    } finally {
      setSalvando(false);
    }
  }
  async function abrirHistorico(v) {
    setTipoHistorico("manutencoes");
    setModal("historico");
    setHistorico(null);
    setLocacoes([]);
    setCarregandoLocacoes(true);
    setForm({ veiculo: v });
    try {
      const [dadosHistorico, dadosLocacoes] = await Promise.all([
        veiculoService.historico(v.id),
        veiculoService.locacoesVinculadas(v.id),
      ]);
      setHistorico(dadosHistorico);
      setLocacoes(dadosLocacoes);
    } catch (e) {
      setAlerta({ tipo: "erro", texto: mensagemDeErro(e) });
      setModal(null);
    } finally {
      setCarregandoLocacoes(false);
    }
  }
  async function salvarHistorico(e) {
    e.preventDefault();
    setSalvando(true);
    const { veiculo, ...dados } = form;
    Object.keys(dados).forEach((k) => {
      if (dados[k] === "") delete dados[k];
    });
    ["km", "valor", "valorReparo", "nivelCombustivel", "locacaoId"].forEach(
      (k) => {
        if (dados[k] !== undefined) dados[k] = Number(dados[k]);
      },
    );
    if (dados.data)
      dados.data =
        tipoHistorico === "multas" || tipoHistorico === "vistorias"
          ? toIso(dados.data)
          : toIso(`${dados.data}T12:00:00`);
    if (tipoHistorico === "sinistrosAvarias") {
      dados.status ||= "aberto";
    }
    if (tipoHistorico === "multas") dados.status ||= "pendente";
    try {
      await veiculoService.cadastrarHistorico(veiculo.id, tipoHistorico, dados);
      setHistorico(await veiculoService.historico(veiculo.id));
      setForm({ veiculo });
      setAlerta({ tipo: "sucesso", texto: "Registro histórico cadastrado." });
    } catch (err) {
      setAlerta({ tipo: "erro", texto: mensagemDeErro(err) });
    } finally {
      setSalvando(false);
    }
  }
  function campoChange(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }
  function renderHistorico(r, key) {
    if (key === "data" && r) return new Date(r).toLocaleString("pt-BR");
    if (key === "status" || key === "tipo") return nome(r);
    if (key === "valor" || key === "valorReparo")
      return r == null ? "—" : formatarMoeda(Number(r));
    return String(r ?? "—");
  }
  const registrosHistorico =
    tipoHistorico === "sinistrosAvarias"
      ? historico?.sinistros || []
      : historico?.[tipoHistorico] || [];

  return (
    <>
      <div className="cabecalho-pagina frota-topo">
        <div>
          <p className="frota-eyebrow">GESTÃO DE ATIVOS</p>
          <h1>Frota de veículos</h1>
          <p className="apoio">
            {admin
              ? "Visão operacional e gestão completa da frota."
              : "Consulte veículos e disponibilidade para locação."}
          </p>
        </div>
        {admin && (
          <button
            className="botao botao-principal"
            onClick={() => abrirCadastro(null)}
          >
            ＋ Cadastrar veículo
          </button>
        )}
      </div>
      <Alert alerta={alerta} onFechar={() => setAlerta(null)} />
      <div className="barra-filtro frota-barra">
        <div>
          <h2>Veículos</h2>
          <p className="apoio">
            {veiculos.length} {veiculos.length === 1 ? "veículo" : "veículos"}{" "}
            exibidos
          </p>
        </div>
        <div
          className="filtro frota-filtros"
          role="group"
          aria-label="Filtrar por status"
        >
          {filtros.map((x) => (
            <button
              key={x.valor}
              type="button"
              aria-pressed={filtro === x.valor}
              onClick={() => setFiltro(x.valor)}
            >
              {x.rotulo}
            </button>
          ))}
        </div>
      </div>
      {carregando ? (
        <p className="carregando-pagina">Carregando frota...</p>
      ) : veiculos.length === 0 ? (
        <div className="vazio">
          <strong>Nenhum veículo encontrado</strong>
          <p>
            Experimente outro filtro{admin ? " ou cadastre um veículo." : "."}
          </p>
        </div>
      ) : (
        <div className="grade-veiculos frota-grade">
          {veiculos.map((v) => (
            <article className="cartao-veiculo frota-card" key={v.id}>
              <div className="frota-card-top">
                <span className="frota-car-icon" aria-hidden="true">
                  ▰
                </span>
                <span
                  className={`frota-status status-${String(v.status || "inativo").toLowerCase()}`}
                >
                  {statusNome[v.status] || "Status não informado"}
                </span>
              </div>
              <div>
                <h3>
                  {v.marca} {v.modelo}
                  {v.versao ? ` ${v.versao}` : ""}
                </h3>
                <p className="frota-subtitle">
                  {v.anoModelo ||
                    v.anoFabricacao ||
                    v.ano ||
                    "Ano não informado"}
                  {v.categoria?.nome ? ` · ${v.categoria.nome}` : ""}
                </p>
              </div>
              <div className="frota-placa-row">
                <span>{v.cor || "Cor não informada"}</span>
              </div>
              <div className="frota-card-bottom">
                <div className="frota-preco">
                  {v.valorDiaria > 0 ? (
                    <>
                      <strong>{formatarMoeda(v.valorDiaria)}</strong>
                      <small>/ dia</small>
                    </>
                  ) : (
                    <span className="frota-pendente">
                      Precificação pendente
                    </span>
                  )}
                </div>
                {v.status === "disponivel" && v.valorDiaria > 0 && (
                  <Link
                    className="botao botao-principal"
                    to={`/locacoes?veiculoId=${v.id}`}
                  >
                    Alugar
                  </Link>
                )}
              </div>
              {admin && (
                <div className="frota-acoes">
                  <button
                    className="botao botao-secundario"
                    onClick={() => editarVeiculo(v)}
                  >
                    Editar
                  </button>
                  <button
                    className="botao botao-secundario"
                    onClick={() => abrirHistorico(v)}
                  >
                    Histórico
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      {modal === "novo" || modal === "editar" ? (
        <Modal
          titulo={modal === "novo" ? "Cadastrar veículo" : "Editar veículo"}
          fechar={() => setModal(null)}
          largo
        >
          <form className="frota-form" onSubmit={salvarVeiculo}>
            <p className="frota-nota">
              A tarifa de locação é definida em etapa própria e não faz parte do
              cadastro.
            </p>
            {secoes.map(([titulo, campos]) => (
              <fieldset key={titulo} className="frota-secao">
                <legend>{titulo}</legend>
                <div className="grade-campos">
                  {campos.map((c) => (
                    <Campo
                      key={c[0]}
                      campo={c}
                      valor={form[c[0]]}
                      onChange={campoChange}
                      metadados={metadados}
                    />
                  ))}
                </div>
                {titulo === "Características" && (
                  <fieldset className="frota-opcionais">
                    <legend>Opcionais</legend>
                    <div className="frota-checks">
                      {opcionais.map((o) => {
                        const id = typeof o === "object" ? Number(o.id) : null;
                        const chave = id ?? String(o);
                        const rotulo =
                          typeof o === "string"
                            ? nome(o)
                            : o.nome || o.descricao || o.codigo;
                        const atual = Array.isArray(form.opcionais)
                          ? form.opcionais
                          : [];
                        return (
                          <label key={chave} className="frota-check">
                            <input
                              type="checkbox"
                              checked={
                                id != null
                                  ? atual.includes(id)
                                  : atual.includes(chave)
                              }
                              onChange={(e) =>
                                campoChange(
                                  "opcionais",
                                  e.target.checked
                                    ? [...atual, chave]
                                    : atual.filter((x) => x !== chave),
                                )
                              }
                            />
                            {rotulo}
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                )}
              </fieldset>
            ))}
            <footer className="frota-modal-actions">
              <button
                type="button"
                className="botao botao-secundario"
                onClick={() => setModal(null)}
              >
                Cancelar
              </button>
              <button className="botao botao-principal" disabled={salvando}>
                {salvando ? "Salvando…" : "Salvar veículo"}
              </button>
            </footer>
          </form>
        </Modal>
      ) : null}
      {modal === "historico" && (
        <Modal
          titulo={`Histórico · ${form.veiculo?.marca} ${form.veiculo?.modelo}`}
          fechar={() => setModal(null)}
          largo
        >
          <div
            className="frota-history-tabs"
            role="tablist"
            aria-label="Tipo de histórico"
          >
            {Object.entries(tipos).map(([k, t]) => (
              <button
                type="button"
                key={k}
                role="tab"
                aria-selected={tipoHistorico === k}
                className={tipoHistorico === k ? "selecionado" : ""}
                onClick={() => {
                  setTipoHistorico(k);
                  setForm({ veiculo: form.veiculo });
                }}
              >
                {t.titulo}
              </button>
            ))}
          </div>
          <section className="frota-historico-lista" aria-live="polite">
            {historico ? (
              registrosHistorico.length ? (
                <div className="frota-tabela-scroll">
                  <table className="tabela-usuarios">
                    <thead>
                      <tr>
                        {tipos[tipoHistorico].campos.map(([k, label]) => (
                          <th key={k}>{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {registrosHistorico.map((r, i) => (
                        <tr key={r.id || i}>
                          {tipos[tipoHistorico].campos.map(([k, label]) => (
                            <td key={k} data-label={label}>
                              {renderHistorico(r[k], k)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="vazio">
                  Nenhum registro de {tipos[tipoHistorico].titulo.toLowerCase()}
                  .
                </p>
              )
            ) : (
              <p className="carregando-pagina">Carregando histórico…</p>
            )}
          </section>
          <form
            className="frota-form frota-historico-form"
            onSubmit={salvarHistorico}
          >
            <h3>
              Novo registro de {tipos[tipoHistorico].titulo.toLowerCase()}
            </h3>
            <div className="grade-campos">
              {tipos[tipoHistorico].campos.map(
                ([key, label, type, options, required]) => (
                  <label key={key} htmlFor={`hist-${key}`}>
                    {label}
                    {type === "select" ? (
                      <select
                        id={`hist-${key}`}
                        name={key}
                        value={
                          form[key] ||
                          (key === "status"
                            ? tipoHistorico === "sinistrosAvarias"
                              ? "aberto"
                              : tipoHistorico === "multas"
                                ? "pendente"
                                : ""
                            : "")
                        }
                        onChange={(e) => campoChange(key, e.target.value)}
                        required={required || options === true}
                      >
                        <option value="">Selecione</option>
                        {(Array.isArray(options) ? options : []).map((o) => (
                          <option key={o} value={o}>
                            {nome(o)}
                          </option>
                        ))}
                      </select>
                    ) : type === "locacao" ? (
                      <select
                        id={`hist-${key}`}
                        name={key}
                        value={form[key] ? String(form[key]) : ""}
                        onChange={(e) => campoChange(key, e.target.value)}
                        disabled={carregandoLocacoes}
                      >
                        <option value="">
                          {carregandoLocacoes
                            ? "Carregando locações…"
                            : "Sem vínculo (opcional)"}
                        </option>
                        {locacoes.map((locacao) => (
                          <option key={locacao.id} value={locacao.id}>
                            #{locacao.id} ·{" "}
                            {dataHoraLegivel(locacao.dataInicio)}
                            {" → "}
                            {dataHoraLegivel(
                              locacao.dataPrevistaDevolucao,
                            )} · {nome(locacao.status)}
                          </option>
                        ))}
                        {!carregandoLocacoes && locacoes.length === 0 && (
                          <option disabled>
                            Este veículo ainda não possui locações
                          </option>
                        )}
                      </select>
                    ) : (
                      <input
                        id={`hist-${key}`}
                        type={type}
                        name={key}
                        value={
                          type === "datetime-local"
                            ? dateTimeInput(form[key])
                            : form[key] || ""
                        }
                        onChange={(e) => campoChange(key, e.target.value)}
                        required={required || options === true}
                        min={type === "number" ? 0 : undefined}
                        max={key === "nivelCombustivel" ? 100 : undefined}
                        step={
                          ["valor", "valorReparo"].includes(key) ? "0.01" : "1"
                        }
                        maxLength={
                          ["descricao", "observacoes", "infracao"].includes(key)
                            ? 500
                            : undefined
                        }
                      />
                    )}
                  </label>
                ),
              )}
            </div>
            <div className="frota-modal-actions">
              <button className="botao botao-principal" disabled={salvando}>
                {salvando ? "Salvando…" : "Adicionar registro"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
