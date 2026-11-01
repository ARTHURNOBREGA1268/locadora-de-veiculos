export default function Alert({ alerta, onFechar }) {
  if (!alerta) return null;

  return (
    <div className={`alerta alerta-${alerta.tipo}`} role={alerta.tipo === 'erro' ? 'alert' : 'status'}>
      <span>{alerta.texto}</span>
      {onFechar && (
        <button type="button" className="alerta-fechar" onClick={onFechar} aria-label="Fechar mensagem">
          Fechar
        </button>
      )}
    </div>
  );
}
