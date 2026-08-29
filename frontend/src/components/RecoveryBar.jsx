import { fmt } from '../api';

export default function RecoveryBar({ name, emoji, recovered, total_cost, pct, amort_sessions, hideLabel = false, color }) {
  const done = pct >= 100;
  const fillStyle = color && !done
    ? { background: color }
    : undefined;

  return (
    <div className="recovery-item">
      {!hideLabel && (
        <div className="recovery-header">
          <span className="recovery-name">{emoji} {name}</span>
          <span className="recovery-pct">{done ? 'Fully recovered' : `${pct.toFixed(1)}%`}</span>
        </div>
      )}
      {hideLabel && (
        <div className="recovery-header">
          <span className="recovery-pct" style={{ marginLeft: 'auto' }}>{done ? 'Fully recovered' : `${pct.toFixed(1)}%`}</span>
        </div>
      )}
      <div className="recovery-track">
        <div className={`recovery-fill ${done ? 'done' : ''}`} style={{ width: `${Math.min(pct, 100)}%`, ...fillStyle }} />
      </div>
      <div className="recovery-amounts">
        <span>{fmt(recovered)} recovered</span>
        <span>{fmt(Math.max(0, total_cost - recovered))} remaining / {amort_sessions} sessions</span>
      </div>
    </div>
  );
}
