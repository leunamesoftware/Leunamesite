import './SeparadorOu.css';

export function SeparadorOu({ className = '' }: { className?: string }) {
  return (
    <div className={`separador-ou ${className}`.trim()} role="separator" aria-label="ou">
      <span aria-hidden="true">ou</span>
    </div>
  );
}
