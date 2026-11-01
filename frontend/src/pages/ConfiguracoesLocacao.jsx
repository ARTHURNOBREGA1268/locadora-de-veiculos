import { useEffect, useState } from "react";
import * as service from "../services/configuracaoLocacaoService";
import { mensagemDeErro } from "../services/api";
import Alert from "../components/Alert";

const inicial = {
  periodoMinimoDiarias: 1,
  periodoMaximoDiarias: 30,
  horarioRetiradaPadrao: "09:00",
  horarioDevolucaoPadrao: "09:00",
  toleranciaAtrasoMinutos: 30,
  antecedenciaMinimaHoras: 2,
  antecedenciaMaximaDias: 90,
  cancelamentoPrazoHoras: 24,
  cancelamentoMultaPercentual: 0,
  idadeMinima: 21,
  tempoMinimoCnhMeses: 12,
  documentosExigidos: [],
  exigeCartaoCredito: true,
  permiteMotoristaAdicional: false,
  maxMotoristasAdicionais: 0,
  kmLivre: true,
  kmFranquiaDiaria: 0,
  politicaCombustivel: "mesmo_nivel",
  filiaisRetirada: [],
  filiaisDevolucao: [],
  permiteDevolucaoOutraFilial: false,
  permiteEntregaDomicilio: false,
  permiteRetiradaAeroporto: false,
  raioEntregaKm: 0,
  protecaoBasicaInclusa: true,
  protecoes: [],
  franquiasCategoria: [],
  caucoesCategoria: [],
  checklistItens: [],
  exigeVistoriaSaida: true,
  exigeVistoriaEntrada: true,
  modeloContrato: "",
  catalogos: { filiais: [], categorias: [] },
};
const documentos = [
  "CNH válida",
  "Documento de identidade",
  "CPF",
  "Comprovante de residência",
];
const numeroCampos = {
  periodoMinimoDiarias: ["Diárias mínimas", 1],
  periodoMaximoDiarias: ["Diárias máximas", 1],
  toleranciaAtrasoMinutos: ["Tolerância de atraso (minutos)", 0],
  antecedenciaMinimaHoras: ["Antecedência mínima (horas)", 0],
  antecedenciaMaximaDias: ["Antecedência máxima (dias)", 1],
  cancelamentoPrazoHoras: ["Prazo para cancelamento (horas)", 0],
  cancelamentoMultaPercentual: ["Multa de cancelamento (%)", 0],
  idadeMinima: ["Idade mínima", 18],
  tempoMinimoCnhMeses: ["Tempo mínimo de CNH (meses)", 0],
  maxMotoristasAdicionais: ["Máximo de motoristas adicionais", 0],
  kmFranquiaDiaria: ["Franquia diária (km)", 0],
  raioEntregaKm: ["Raio de entrega (km)", 0],
};
function Check({ label, checked, onChange }) {
  return (
    <label className="config-check">
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
function Toggle({ label, checked, onChange }) {
  return (
    <label className="config-toggle">
      <span>{label}</span>
      <input
        type="checkbox"
        role="switch"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="config-switch" aria-hidden="true" />
    </label>
  );
}
function Secao({ title, children }) {
  return (
    <section className="painel config-secao">
      <h2>{title}</h2>
      <div className="config-corpo">{children}</div>
    </section>
  );
}
function linhasCategoria(dados, chave) {
  const salvas = new Map(
    dados[chave].map((linha) => [linha.categoriaId, linha]),
  );
  const idsCatalogo = new Set(dados.catalogos.categorias.map((x) => x.id));
  return [
    ...dados.catalogos.categorias.map((categoria) => ({
      ...(salvas.get(categoria.id) || {}),
      categoriaId: categoria.id,
      categoriaNome: categoria.nome,
      valor: salvas.get(categoria.id)?.valor ?? 0,
    })),
    ...dados[chave].filter((linha) => !idsCatalogo.has(linha.categoriaId)),
  ];
}
export default function ConfiguracoesLocacao() {
  const [dados, setDados] = useState(inicial),
    [carregando, setCarregando] = useState(true),
    [salvando, setSalvando] = useState(false),
    [alerta, setAlerta] = useState(null),
    [novoItem, setNovoItem] = useState(""),
    [novaProtecao, setNovaProtecao] = useState({ nome: "", descricao: "" }),
    [arrastando, setArrastando] = useState(null);
  useEffect(() => {
    service
      .obter()
      .then((r) =>
        setDados({
          ...inicial,
          ...r,
          catalogos: { ...inicial.catalogos, ...r.catalogos },
        }),
      )
      .catch((e) => setAlerta({ tipo: "erro", texto: mensagemDeErro(e) }))
      .finally(() => setCarregando(false));
  }, []);
  const campo = (k, v) => setDados((d) => ({ ...d, [k]: v }));
  const mover = (from, to) => {
    if (from === to || to < 0) return;
    const itens = [...dados.checklistItens];
    const [item] = itens.splice(from, 1);
    itens.splice(to, 0, item);
    campo(
      "checklistItens",
      itens.map((x, ordem) => ({ ...x, ordem })),
    );
  };
  async function salvar(e) {
    e.preventDefault();
    setAlerta(null);
    if (+dados.periodoMaximoDiarias < +dados.periodoMinimoDiarias)
      return setAlerta({
        tipo: "erro",
        texto: "O período máximo deve ser igual ou maior que o mínimo.",
      });
    if (
      +dados.cancelamentoMultaPercentual < 0 ||
      +dados.cancelamentoMultaPercentual > 100
    )
      return setAlerta({
        tipo: "erro",
        texto: "A multa deve estar entre 0 e 100%.",
      });
    setSalvando(true);
    try {
      const payload = { ...dados };
      delete payload.catalogos;
      const r = await service.salvar(payload);
      setDados((d) => ({ ...d, ...r, catalogos: d.catalogos }));
      setAlerta({
        tipo: "sucesso",
        texto: "Configurações de locação salvas com sucesso.",
      });
    } catch (err) {
      setAlerta({ tipo: "erro", texto: mensagemDeErro(err) });
    } finally {
      setSalvando(false);
    }
  }
  if (carregando)
    return (
      <p className="carregando-pagina">
        Carregando configurações de locação...
      </p>
    );
  return (
    <>
      <div className="cabecalho-pagina">
        <p className="frota-eyebrow">ADMINISTRAÇÃO</p>
        <h1>Configurações de locação</h1>
        <p className="apoio">
          Defina regras, serviços e etapas aplicadas às novas locações.
        </p>
      </div>
      <Alert alerta={alerta} onFechar={() => setAlerta(null)} />
      <form className="config-form" onSubmit={salvar}>
        <Secao title="Regras gerais">
          <div className="grade-campos">
            {Object.entries(numeroCampos)
              .filter(([k]) =>
                [
                  "periodoMinimoDiarias",
                  "periodoMaximoDiarias",
                  "toleranciaAtrasoMinutos",
                  "antecedenciaMinimaHoras",
                  "antecedenciaMaximaDias",
                  "cancelamentoPrazoHoras",
                  "cancelamentoMultaPercentual",
                ].includes(k),
              )
              .map(([k, [label, min]]) => (
                <label key={k}>
                  {label}
                  <input
                    type="number"
                    min={min}
                    value={dados[k] ?? 0}
                    onChange={(e) =>
                      campo(
                        k,
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    required
                  />
                </label>
              ))}
            <label>
              Horário padrão de retirada
              <input
                type="time"
                value={dados.horarioRetiradaPadrao || ""}
                onChange={(e) => campo("horarioRetiradaPadrao", e.target.value)}
              />
            </label>
            <label>
              Horário padrão de devolução
              <input
                type="time"
                value={dados.horarioDevolucaoPadrao || ""}
                onChange={(e) =>
                  campo("horarioDevolucaoPadrao", e.target.value)
                }
              />
            </label>
          </div>
        </Secao>
        <Secao title="Condições do locatário">
          <div className="config-checks">
            {documentos.map((x) => (
              <Check
                key={x}
                label={x}
                checked={dados.documentosExigidos.includes(x)}
                onChange={(on) =>
                  campo(
                    "documentosExigidos",
                    on
                      ? [...dados.documentosExigidos, x]
                      : dados.documentosExigidos.filter((v) => v !== x),
                  )
                }
              />
            ))}
          </div>
          <div className="grade-campos">
            {[
              "idadeMinima",
              "tempoMinimoCnhMeses",
              "maxMotoristasAdicionais",
            ].map((k) => (
              <label key={k}>
                {numeroCampos[k][0]}
                <input
                  type="number"
                  min={numeroCampos[k][1]}
                  value={dados[k] ?? 0}
                  onChange={(e) => campo(k, Number(e.target.value))}
                />
              </label>
            ))}
          </div>
          <Toggle
            label="Exige cartão de crédito"
            checked={dados.exigeCartaoCredito}
            onChange={(v) => campo("exigeCartaoCredito", v)}
          />
          <Toggle
            label="Permite motorista adicional"
            checked={dados.permiteMotoristaAdicional}
            onChange={(v) => campo("permiteMotoristaAdicional", v)}
          />
        </Secao>
        <Secao title="Quilometragem e combustível">
          <Toggle
            label="Quilometragem livre"
            checked={dados.kmLivre}
            onChange={(v) => campo("kmLivre", v)}
          />
          {!dados.kmLivre && (
            <label>
              Franquia diária (km)
              <input
                type="number"
                min="0"
                value={dados.kmFranquiaDiaria}
                onChange={(e) =>
                  campo("kmFranquiaDiaria", Number(e.target.value))
                }
              />
            </label>
          )}
          <label>
            Política de combustível
            <select
              value={dados.politicaCombustivel}
              onChange={(e) => campo("politicaCombustivel", e.target.value)}
            >
              <option value="mesmo_nivel">Devolver no mesmo nível</option>
              <option value="cobrar_reposicao">Cobrar reposição</option>
              <option value="tanque_cheio_pre_pago">
                Tanque cheio pré-pago
              </option>
            </select>
          </label>
        </Secao>
        <Secao title="Retirada e devolução">
          <div className="grade-campos">
            {[
              ["filiaisRetirada", "Filiais disponíveis para retirada"],
              ["filiaisDevolucao", "Filiais disponíveis para devolução"],
            ].map(([key, label]) => (
              <fieldset className="config-fieldset" key={key}>
                <legend>{label}</legend>
                {dados.catalogos.filiais.length ? (
                  dados.catalogos.filiais.map((f) => (
                    <Check
                      key={f.id}
                      label={f.nome}
                      checked={dados[key].includes(f.id)}
                      onChange={(on) =>
                        campo(
                          key,
                          on
                            ? [...dados[key], f.id]
                            : dados[key].filter((id) => id !== f.id),
                        )
                      }
                    />
                  ))
                ) : (
                  <p className="apoio">Nenhuma filial disponível.</p>
                )}
              </fieldset>
            ))}
          </div>
          <Toggle
            label="Permite devolução em outra filial"
            checked={dados.permiteDevolucaoOutraFilial}
            onChange={(v) => campo("permiteDevolucaoOutraFilial", v)}
          />
          <Toggle
            label="Permite entrega em domicílio"
            checked={dados.permiteEntregaDomicilio}
            onChange={(v) => campo("permiteEntregaDomicilio", v)}
          />
          <Toggle
            label="Permite retirada no aeroporto"
            checked={dados.permiteRetiradaAeroporto}
            onChange={(v) => campo("permiteRetiradaAeroporto", v)}
          />
          {dados.permiteEntregaDomicilio && (
            <label>
              Raio de entrega (km)
              <input
                type="number"
                min="0"
                value={dados.raioEntregaKm}
                onChange={(e) => campo("raioEntregaKm", Number(e.target.value))}
              />
            </label>
          )}
        </Secao>
        <Secao title="Proteções, franquias e cauções">
          <Toggle
            label="Proteção básica inclusa"
            checked={dados.protecaoBasicaInclusa}
            onChange={(v) => campo("protecaoBasicaInclusa", v)}
          />
          <h3>Catálogo de proteções</h3>
          {dados.protecoes.map((p, i) => (
            <div className="config-protecao" key={p.id ?? i}>
              <label>
                Nome da proteção
                <input
                  maxLength="80"
                  value={p.nome}
                  onChange={(e) =>
                    campo(
                      "protecoes",
                      dados.protecoes.map((x, j) =>
                        j === i ? { ...x, nome: e.target.value } : x,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Descrição
                <input
                  maxLength="2000"
                  value={p.descricao || ""}
                  onChange={(e) =>
                    campo(
                      "protecoes",
                      dados.protecoes.map((x, j) =>
                        j === i ? { ...x, descricao: e.target.value } : x,
                      ),
                    )
                  }
                />
              </label>
              <Check
                label="Disponível para novas locações"
                checked={p.ativo}
                onChange={(v) =>
                  campo(
                    "protecoes",
                    dados.protecoes.map((x, j) =>
                      j === i ? { ...x, ativo: v } : x,
                    ),
                  )
                }
              />
              <Check
                label="Incluir como proteção opcional"
                checked={p.selecionada}
                onChange={(v) =>
                  campo(
                    "protecoes",
                    dados.protecoes.map((x, j) =>
                      j === i ? { ...x, selecionada: v } : x,
                    ),
                  )
                }
              />
            </div>
          ))}
          <div className="config-adicionar">
            <label htmlFor="nova-protecao">Cadastrar proteção</label>
            <input
              id="nova-protecao"
              maxLength="80"
              value={novaProtecao.nome}
              onChange={(e) =>
                setNovaProtecao((p) => ({ ...p, nome: e.target.value }))
              }
              placeholder="Nome da proteção"
            />
            <input
              maxLength="2000"
              value={novaProtecao.descricao}
              onChange={(e) =>
                setNovaProtecao((p) => ({ ...p, descricao: e.target.value }))
              }
              placeholder="Descrição (opcional)"
            />
            <button
              type="button"
              className="botao botao-secundario"
              disabled={!novaProtecao.nome.trim()}
              onClick={() => {
                campo("protecoes", [
                  ...dados.protecoes,
                  {
                    nome: novaProtecao.nome.trim(),
                    descricao: novaProtecao.descricao.trim(),
                    ativo: true,
                    selecionada: false,
                  },
                ]);
                setNovaProtecao({ nome: "", descricao: "" });
              }}
            >
              Adicionar proteção
            </button>
          </div>
          <div className="config-tabelas">
            {[
              ["franquiasCategoria", "Franquias por categoria"],
              ["caucoesCategoria", "Cauções por categoria"],
            ].map(([key, title]) => (
              <div key={key}>
                <h3>{title}</h3>
                <div className="tabela-usuarios-scroll">
                  <table className="tabela-usuarios config-tabela">
                    <thead>
                      <tr>
                        <th>Categoria</th>
                        <th>Valor (R$)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhasCategoria(dados, key).map((row, i) => (
                        <tr key={row.categoriaId}>
                          <td data-label="Categoria">{row.categoriaNome}</td>
                          <td data-label="Valor (R$)">
                            <input
                              aria-label={`${title}: ${row.categoriaNome}`}
                              type="number"
                              min="0"
                              max="99999999.99"
                              step="0.01"
                              value={row.valor ?? 0}
                              onChange={(e) => {
                                const rows = linhasCategoria(dados, key);
                                rows[i] = {
                                  ...rows[i],
                                  valor: Number(e.target.value),
                                };
                                campo(key, rows);
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!dados.catalogos.categorias.length && !dados[key].length && (
                    <p className="apoio">Nenhuma categoria disponível.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Secao>
        <Secao title="Vistorias e contrato">
          <Toggle
            label="Exigir vistoria de saída"
            checked={dados.exigeVistoriaSaida}
            onChange={(v) => campo("exigeVistoriaSaida", v)}
          />
          <Toggle
            label="Exigir vistoria de entrada/devolução"
            checked={dados.exigeVistoriaEntrada}
            onChange={(v) => campo("exigeVistoriaEntrada", v)}
          />
          <h3>Checklist de vistoria</h3>
          <p className="apoio">
            Arraste os itens para alterar a ordem e marque quais fazem parte da
            configuração do checklist.
          </p>
          <ol className="config-checklist">
            {dados.checklistItens.map((item, i) => (
              <li
                key={item.id ?? i}
                draggable
                onDragStart={() => setArrastando(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  mover(arrastando, i);
                  setArrastando(null);
                }}
                className={arrastando === i ? "arrastando" : ""}
              >
                <span
                  className="config-alca"
                  aria-label="Arrastar para reordenar"
                >
                  ⠿
                </span>
                <input
                  aria-label="Descrição do item"
                  maxLength="120"
                  value={item.descricao}
                  onChange={(e) =>
                    campo(
                      "checklistItens",
                      dados.checklistItens.map((x, j) =>
                        j === i ? { ...x, descricao: e.target.value } : x,
                      ),
                    )
                  }
                />
                <Check
                  label="Obrigatório"
                  checked={item.obrigatorio}
                  onChange={(v) =>
                    campo(
                      "checklistItens",
                      dados.checklistItens.map((x, j) =>
                        j === i ? { ...x, obrigatorio: v } : x,
                      ),
                    )
                  }
                />
                <Check
                  label="Ativo"
                  checked={item.ativo}
                  onChange={(v) =>
                    campo(
                      "checklistItens",
                      dados.checklistItens.map((x, j) =>
                        j === i ? { ...x, ativo: v } : x,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  className="botao botao-secundario"
                  aria-label={`Remover ${item.descricao}`}
                  onClick={() =>
                    campo(
                      "checklistItens",
                      dados.checklistItens.filter((_, j) => j !== i),
                    )
                  }
                >
                  Remover
                </button>
              </li>
            ))}
          </ol>
          <div className="config-adicionar">
            <label htmlFor="novo-checklist">Novo item de vistoria</label>
            <div>
              <input
                id="novo-checklist"
                value={novoItem}
                onChange={(e) => setNovoItem(e.target.value)}
                placeholder="Ex.: Conferir pneus"
              />
              <button
                type="button"
                className="botao botao-secundario"
                disabled={!novoItem.trim()}
                onClick={() => {
                  campo("checklistItens", [
                    ...dados.checklistItens,
                    {
                      descricao: novoItem.trim(),
                      obrigatorio: false,
                      ativo: true,
                      ordem: dados.checklistItens.length,
                    },
                  ]);
                  setNovoItem("");
                }}
              >
                Adicionar item
              </button>
            </div>
          </div>
          <label>
            Modelo do contrato
            <textarea
              rows="8"
              value={dados.modeloContrato}
              onChange={(e) => campo("modeloContrato", e.target.value)}
              placeholder="Insira o modelo do contrato..."
            />
          </label>
        </Secao>
        <div className="config-salvar">
          <p className="apoio">
            As políticas são salvas para a locadora. Regras que dependem de
            dados do cliente, pagamento, filial ou vistoria exigem integrações
            adicionais antes de serem aplicadas automaticamente.
          </p>
          <button
            className="botao botao-principal"
            type="submit"
            disabled={salvando}
          >
            {salvando ? "Salvando configurações…" : "Salvar configurações"}
          </button>
        </div>
      </form>
    </>
  );
}
