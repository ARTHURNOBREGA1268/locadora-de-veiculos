import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import * as veiculoService from '../services/veiculoService';
import { mensagemDeErro } from '../services/api';
import Alert from '../components/Alert';
import VeiculoForm from '../components/VeiculoForm';
import VeiculoList from '../components/VeiculoList';

const filtros = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'true', rotulo: 'Disponíveis' },
  { valor: 'false', rotulo: 'Alugados' }
];

export default function Veiculos() {
  const { usuario } = useAuth();
  const [veiculos, setVeiculos] = useState([]);
  const [filtro, setFiltro] = useState('todos');
  const [carregando, setCarregando] = useState(true);
  const [alerta, setAlerta] = useState(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const lista = await veiculoService.listar(filtro === 'todos' ? undefined : filtro);
      setVeiculos(lista);
    } catch (erro) {
      setAlerta({ tipo: 'erro', texto: mensagemDeErro(erro) });
    } finally {
      setCarregando(false);
    }
  }, [filtro]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function cadastrar(dados) {
    setAlerta(null);
    try {
      const veiculo = await veiculoService.cadastrar(dados);
      setAlerta({ tipo: 'sucesso', texto: `Veículo ${veiculo.marca} ${veiculo.modelo} (${veiculo.placa}) cadastrado.` });
      await carregar();
      return true;
    } catch (erro) {
      setAlerta({ tipo: 'erro', texto: mensagemDeErro(erro) });
      return false;
    }
  }

  return (
    <>
      <div className="cabecalho-pagina">
        <h1>Veículos</h1>
        <p className="apoio">{usuario?.papel === 'ADMIN' ? 'Gerencie a frota e acompanhe a disponibilidade.' : 'Consulte a frota e acompanhe a disponibilidade.'}</p>
      </div>
      <Alert alerta={alerta} onFechar={() => setAlerta(null)} />
      {usuario?.papel === 'ADMIN' && <VeiculoForm onSubmit={cadastrar} />}
      <div className="barra-filtro">
        <h2>Frota</h2>
        <div className="filtro" role="group" aria-label="Filtrar por disponibilidade">
          {filtros.map((item) => (
            <button key={item.valor} type="button" aria-pressed={filtro === item.valor} onClick={() => setFiltro(item.valor)}>
              {item.rotulo}
            </button>
          ))}
        </div>
      </div>
      {carregando ? <p className="carregando-pagina">Carregando veículos...</p> : <VeiculoList veiculos={veiculos} />}
    </>
  );
}
