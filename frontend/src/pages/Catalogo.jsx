import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import Alert from "../components/Alert";
import * as catalogoService from "../services/catalogoService";
import { mensagemDeErro } from "../services/api";

const cambioLabel = { manual: "Manual", automatico: "Automático" };
const combustivelLabel = {
  gasolina: "Gasolina",
  etanol: "Etanol",
  flex: "Flex",
  diesel: "Diesel",
  eletrico: "Elétrico",
  hibrido: "Híbrido",
};
const politicaCombustivelLabel = {
  mesmo_nivel: "Devolução no mesmo nível da retirada",
  cobrar_reposicao: "Reposição de combustível cobrada no retorno",
  tanque_cheio_pre_pago: "Tanque cheio pré-pago",
};

function formatarMeses(meses) {
  const total = Number(meses || 0);
  if (total >= 12 && total % 12 === 0) {
    const anos = total / 12;
    return `${anos} ${anos === 1 ? "ano" : "anos"}`;
  }
  return `${total} ${total === 1 ? "mês" : "meses"}`;
}

function ItemRegra({ titulo, children }) {
  return (
    <article className="catalogo-regra">
      <span>{titulo}</span>
      <strong>{children}</strong>
    </article>
  );
}

export default function Catalogo() {
  const [veiculos, setVeiculos] = useState([]);
  const [regras, setRegras] = useState(null);
  const [carregandoVeiculos, setCarregandoVeiculos] = useState(true);
  const [carregandoRegras, setCarregandoRegras] = useState(true);
  const [erroVeiculos, setErroVeiculos] = useState("");
  const [erroRegras, setErroRegras] = useState("");
  const [busca, setBusca] = useState("");
  const [categoriaSelecionada, setCategoriaSelecionada] = useState("todas");

  useEffect(() => {
    let ativo = true;
    catalogoService
      .listarVeiculos()
      .then((dados) => {
        if (ativo) setVeiculos(Array.isArray(dados) ? dados : []);
      })
      .catch((erro) => {
        if (ativo) setErroVeiculos(mensagemDeErro(erro));
      })
      .finally(() => {
        if (ativo) setCarregandoVeiculos(false);
      });
    catalogoService
      .obterRegras()
      .then((dados) => {
        if (ativo) setRegras(dados);
      })
      .catch((erro) => {
        if (ativo) setErroRegras(mensagemDeErro(erro));
      })
      .finally(() => {
        if (ativo) setCarregandoRegras(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const categorias = useMemo(() => {
    const unicas = new Map();
    veiculos.forEach((veiculo) => {
      const categoria = veiculo.categoria;
      if (categoria?.id != null && categoria?.nome)
        unicas.set(String(categoria.id), categoria.nome);
    });
    return [...unicas.entries()].sort((a, b) =>
      a[1].localeCompare(b[1], "pt-BR"),
    );
  }, [veiculos]);

  const resultados = useMemo(() => {
    const termo = busca
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR");
    return veiculos.filter((veiculo) => {
      const campos = [
        veiculo.marca,
        veiculo.modelo,
        veiculo.versao,
        veiculo.categoria?.nome,
        combustivelLabel[veiculo.combustivel],
      ]
        .filter(Boolean)
        .join(" ")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("pt-BR");
      const correspondeBusca = !termo || campos.includes(termo);
      const correspondeCategoria =
        categoriaSelecionada === "todas" ||
        String(veiculo.categoria?.id) === categoriaSelecionada;
      return correspondeBusca && correspondeCategoria;
    });
  }, [veiculos, busca, categoriaSelecionada]);

  return (
    <div className="catalogo-pagina">
      <section className="catalogo-hero" aria-labelledby="catalogo-titulo">
        <div className="catalogo-hero-conteudo">
          <span className="catalogo-etiqueta">Mobilidade do seu jeito</span>
          <h1 id="catalogo-titulo">Seu próximo caminho começa aqui.</h1>
          <p>
            Encontre o veículo ideal, escolha as datas e receba uma cotação
            transparente antes de confirmar sua reserva.
          </p>
          <div className="catalogo-hero-acoes">
            <a className="botao botao-claro" href="#catalogo-veiculos">
              Explorar veículos
            </a>
            <a className="catalogo-link-hero" href="#regras-locacao">
              Conhecer as regras
            </a>
          </div>
          <div className="catalogo-hero-beneficios" aria-label="Benefícios">
            <span>Preço calculado para o seu período</span>
            <span>Reserva sujeita à disponibilidade das datas</span>
          </div>
        </div>
        <div className="catalogo-hero-foto" role="img" aria-label="Veículo em uma viagem, imagem ilustrativa">
          <span>Liberdade para ir mais longe</span>
          <small>Imagem ilustrativa · consulte os veículos da frota abaixo</small>
        </div>
      </section>

      <section id="catalogo-veiculos" className="catalogo-secao" aria-labelledby="catalogo-lista-titulo">
        <div className="catalogo-secao-cabecalho">
          <div>
            <span className="catalogo-overline">Frota disponível</span>
            <h2 id="catalogo-lista-titulo">Escolha o veículo da sua viagem</h2>
            <p className="apoio">
              A disponibilidade final é confirmada para as datas que você informar.
            </p>
          </div>
          <span className="catalogo-contagem" aria-live="polite">
            {carregandoVeiculos
              ? "Carregando opções…"
              : `${resultados.length} ${resultados.length === 1 ? "veículo" : "veículos"}`}
          </span>
        </div>

        {erroVeiculos && <Alert alerta={{ tipo: "erro", texto: erroVeiculos }} />}
        <div className="catalogo-filtros">
          <label>
            Buscar veículo
            <input
              type="search"
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Marca, modelo, categoria ou combustível"
              aria-label="Buscar veículo por marca, modelo, categoria ou combustível"
            />
          </label>
          <label>
            Categoria
            <select
              value={categoriaSelecionada}
              onChange={(evento) => setCategoriaSelecionada(evento.target.value)}
            >
              <option value="todas">Todas as categorias</option>
              {categorias.map(([id, nome]) => (
                <option key={id} value={id}>{nome}</option>
              ))}
            </select>
          </label>
        </div>

        {carregandoVeiculos ? (
          <p className="carregando-pagina">Carregando veículos disponíveis…</p>
        ) : resultados.length === 0 ? (
          <div className="catalogo-vazio">
            <span className="catalogo-vazio-selo">Frota atualizada</span>
            <h3>{veiculos.length ? "Nenhum resultado para estes filtros" : "Nenhum veículo disponível neste momento"}</h3>
            <p>
              {veiculos.length
                ? "Altere a busca ou a categoria para ver outras opções."
                : "Volte em breve ou fale com nossa equipe para consultar outras datas."}
            </p>
            {veiculos.length > 0 && (
              <button
                type="button"
                className="botao botao-secundario"
                onClick={() => { setBusca(""); setCategoriaSelecionada("todas"); }}
              >
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="catalogo-grade">
            {resultados.map((veiculo) => (
              <article className="catalogo-card" key={veiculo.id}>
                <div className="catalogo-card-visual">
                  <span className="catalogo-disponivel"><i aria-hidden="true" /> Disponível</span>
                  <span className="catalogo-card-categoria">
                    {veiculo.categoria?.nome || "Categoria não informada"}
                  </span>
                  <span className="catalogo-carro-silhueta" aria-hidden="true">
                    <svg viewBox="0 0 220 100" fill="none">
                      <path d="M34 62 47 38c3-6 9-10 16-11l42-7c8-1 16 2 21 8l21 24 22 5c6 1 10 6 10 12v9h-15a18 18 0 0 0-36 0H79a18 18 0 0 0-36 0H28v-9c0-4 2-7 6-8Z" fill="currentColor" />
                      <path d="m61 41 8-10 35-6v22H55l6-6Zm50-15 10 2 18 19h-28V26Z" fill="rgba(255,255,255,.72)" />
                      <circle cx="61" cy="78" r="12" fill="#173a45" stroke="#d9ecef" strokeWidth="5" />
                      <circle cx="146" cy="78" r="12" fill="#173a45" stroke="#d9ecef" strokeWidth="5" />
                      <path d="M30 61h153" stroke="#e7b450" strokeWidth="3" />
                    </svg>
                  </span>
                  <span className="catalogo-card-ano">
                    {veiculo.anoModelo || veiculo.anoFabricacao || "Ano não informado"}
                  </span>
                </div>
                <div className="catalogo-card-conteudo">
                  <div className="catalogo-card-titulo">
                    <div>
                      <h3>{veiculo.marca} {veiculo.modelo}</h3>
                      {veiculo.versao && <p>{veiculo.versao}</p>}
                    </div>
                    <span className="catalogo-cor" title={veiculo.cor || "Cor não informada"}>
                      {veiculo.cor || "—"}
                    </span>
                  </div>
                  <div className="catalogo-especificacoes">
                    <span>{cambioLabel[veiculo.cambio] || "Câmbio não informado"}</span>
                    <span>{combustivelLabel[veiculo.combustivel] || "Combustível não informado"}</span>
                    <span>{veiculo.numPassageiros ? `${veiculo.numPassageiros} passageiros` : "Lugares não informados"}</span>
                    {veiculo.capacidadePortaMalas > 0 && <span>Porta-malas {veiculo.capacidadePortaMalas} L</span>}
                  </div>
                  <div className="catalogo-card-rodape">
                    <p>Valor calculado conforme datas e opções da reserva.</p>
                    <Link className="botao botao-principal" to={`/locacoes?veiculoId=${veiculo.id}`}>
                      Alugar veículo
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section id="regras-locacao" className="catalogo-regras-secao" aria-labelledby="regras-titulo">
        <div className="catalogo-regras-intro">
          <span className="catalogo-overline">Tudo claro antes de reservar</span>
          <h2 id="regras-titulo">Regras de locação</h2>
          <p>
            Condições comerciais vigentes. A cotação e a confirmação da reserva
            seguem os dados atualizados do sistema.
          </p>
        </div>
        {erroRegras && <Alert alerta={{ tipo: "erro", texto: erroRegras }} />}
        {carregandoRegras ? (
          <p className="carregando-pagina">Carregando regras de locação…</p>
        ) : regras ? (
          <>
            <div className="catalogo-regras-grade">
              <ItemRegra titulo="Período mínimo e máximo">
                {regras.periodoMinimoDiarias} a {regras.periodoMaximoDiarias} diárias
              </ItemRegra>
              <ItemRegra titulo="Retirada e devolução">
                {regras.horarioRetiradaPadrao} – {regras.horarioDevolucaoPadrao}
              </ItemRegra>
              <ItemRegra titulo="Antecedência da reserva">
                Mínimo {regras.antecedenciaMinimaHoras} h · máximo {regras.antecedenciaMaximaDias} dias
              </ItemRegra>
              <ItemRegra titulo="Idade mínima">
                {regras.idadeMinima} anos · CNH há pelo menos {formatarMeses(regras.tempoMinimoCnhMeses)}
              </ItemRegra>
              <ItemRegra titulo="Quilometragem">
                {regras.kmLivre ? "Livre" : `${Number(regras.kmFranquiaDiaria || 0).toLocaleString("pt-BR")} km por diária`}
              </ItemRegra>
              <ItemRegra titulo="Combustível">
                {politicaCombustivelLabel[regras.politicaCombustivel] || "Conforme indicado na retirada"}
              </ItemRegra>
            </div>
            <details className="catalogo-regras-detalhes">
              <summary>Ver condições e serviços adicionais</summary>
              <div className="catalogo-regras-grade catalogo-regras-grade-secundaria">
                <ItemRegra titulo="Documentos exigidos">
                  {regras.documentosExigidos.length ? regras.documentosExigidos.join(", ") : "Apresentados na confirmação"}
                </ItemRegra>
                <ItemRegra titulo="Pagamento">
                  {regras.exigeCartaoCredito ? "Cartão de crédito obrigatório" : "Formas conforme opções na reserva"}
                </ItemRegra>
                <ItemRegra titulo="Motorista adicional">
                  {regras.permiteMotoristaAdicional ? `Permitido · até ${regras.maxMotoristasAdicionais}` : "Não permitido"}
                </ItemRegra>
                <ItemRegra titulo="Devolução em outra filial">
                  {regras.permiteDevolucaoOutraFilial ? "Permitida, conforme disponibilidade" : "Não disponível"}
                </ItemRegra>
                <ItemRegra titulo="Entrega em domicílio">
                  {regras.permiteEntregaDomicilio ? `Disponível${regras.raioEntregaKm ? ` em até ${regras.raioEntregaKm} km` : ""}` : "Não disponível"}
                </ItemRegra>
                <ItemRegra titulo="Retirada em aeroporto">
                  {regras.permiteRetiradaAeroporto ? "Disponível mediante seleção na reserva" : "Não disponível"}
                </ItemRegra>
                <ItemRegra titulo="Proteção básica">
                  {regras.protecaoBasicaInclusa ? "Incluída" : "Consulte as opções de proteção"}
                </ItemRegra>
                <ItemRegra titulo="Vistorias">
                  {regras.exigeVistoriaSaida || regras.exigeVistoriaEntrada ? "Checklist na retirada e/ou devolução" : "Conforme o contrato"}
                </ItemRegra>
                <ItemRegra titulo="Cancelamento">
                  {regras.cancelamentoPrazoHoras === 0
                    ? "Consulte as condições do contrato"
                    : `Até ${regras.cancelamentoPrazoHoras} h antes · multa de ${Number(regras.cancelamentoMultaPercentual || 0).toLocaleString("pt-BR")}%, conforme regra vigente`}
                </ItemRegra>
                <ItemRegra titulo="Atraso na devolução">
                  {regras.toleranciaAtrasoMinutos} min de tolerância; após isso podem incidir cobranças previstas na cotação/contrato.
                </ItemRegra>
              </div>
            </details>
          </>
        ) : (
          <div className="catalogo-vazio">
            <p>As regras ainda não estão disponíveis. Consulte a equipe antes de concluir sua reserva.</p>
          </div>
        )}
        <p className="catalogo-regras-rodape">
          A reserva depende da disponibilidade no período e da conferência dos
          requisitos e documentos pela equipe, além da aceitação das condições
          apresentadas no contrato.
        </p>
      </section>
    </div>
  );
}
