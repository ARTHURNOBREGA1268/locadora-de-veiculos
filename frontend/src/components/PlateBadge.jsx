export default function PlateBadge({ placa }) {
  return (
    <span className="placa" aria-label={`Placa ${placa}`}>
      <span className="placa-faixa" aria-hidden="true">BRASIL</span>
      <span className="placa-codigo">{placa}</span>
    </span>
  );
}
