import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { verifyPassword } from '../api';

export default function LockModal({ onClose }) {
  const { unlock }        = useAuth();
  const [pw, setPw]       = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef          = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!pw) return;
    setLoading(true);
    setError('');
    const ok = await verifyPassword(pw).catch(() => false);
    if (ok) { unlock(); onClose(); }
    else    { setError('Incorrect password'); setLoading(false); setPw(''); inputRef.current?.focus(); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-lock-icon">🔒</div>
        <h2 className="modal-title">Unlock</h2>
        <p className="modal-sub">Enter your password to access advantageous mode and settings.</p>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="password"
            className="modal-input"
            value={pw}
            onChange={e => { setPw(e.target.value); setError(''); }}
            placeholder="Password"
            autoComplete="current-password"
          />
          {error && <p className="modal-error">{error}</p>}
          <button type="submit" className="modal-btn" disabled={loading || !pw}>
            {loading ? 'Checking…' : 'Unlock'}
          </button>
        </form>
        <p className="modal-hint">Default password: <code>admin</code></p>
      </div>
    </div>
  );
}
