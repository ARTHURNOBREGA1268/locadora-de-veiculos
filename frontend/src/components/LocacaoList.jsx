import PlateBadge from "./PlateBadge";
import { formatarDataHora, formatarMoeda } from "../utils/format";

const status = {
  reservada: [
    "Reservada",
    "selo-reservada",
    [
      ["cancelar", "Cancelar", "botao-perigo"],
      ["retirar", "Confirmar retirada", "botao-principal"],
    ],
    false,
  ],
  retirada: [
    "Retirada",
    "selo-retirada",
    [["iniciar", "Iniciar locação", "botao-principal"]],
    false,
  ],
  em_andamento: [
    "Em andamento",
    "selo-andamento",
    [["devolver", "Registrar devolução", "botao-principal"]],
    false,
  ],
  devolvida: [
    "Devolvida",
    "selo-devolvida",
    [["finalizar", "Finalizar locação", "botao-principal"]],
    false,
  ],
  finalizada: ["Finalizada", "selo-livre", [], true],
  cancelada: ["Cancelada", "selo-cancelada", [], true],
};

export default function LocacaoList({ locacoes, processandoId, onAcao }) {
  if (locacoes.length === 0)
    return (
      <p className="vazio">
        Você ainda não tem locações. Registre a primeira no formulário acima.
      </p>
    );
  return (
    <div className="lista-locacoes">
      {locacoes.map((locacao) => {
        const [rotulo, classe, acoes] = status[locacao.status] || [
          locacao.status || "Status desconhecido",
          "selo-user",
          [],
        ];
        return (
          <article className="cartao-locacao" key={locacao.id}>
            <PlateBadge placa={locacao.veiculo.placa} />
            <div className="detalhes-locacao">
              <h3>
                {locacao.veiculo.marca} {locacao.veiculo.modelo}
              </h3>
              <span>Retirada: {formatarDataHora(locacao.dataInicio)}</span>
              <span>
                Devolução prevista:{" "}
                {formatarDataHora(locacao.dataPrevistaDevolucao)}
              </span>
              {locacao.dataDevolucaoEfetiva && (
                <span>
                  Devolvido em: {formatarDataHora(locacao.dataDevolucaoEfetiva)}
                </span>
              )}
            </div>
            <div className="lado-locacao">
              <span className="valor">{formatarMoeda(locacao.valorTotal)}</span>
              <span className={`selo ${classe}`}>{rotulo}</span>
              {acoes.map(([acao, texto, estilo]) => (
                <button
                  key={acao}
                  type="button"
                  className={`botao ${estilo}`}
                  disabled={processandoId === locacao.id}
                  onClick={() => onAcao(locacao, acao)}
                >
                  {processandoId === locacao.id ? "Atualizando…" : texto}
                </button>
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}
