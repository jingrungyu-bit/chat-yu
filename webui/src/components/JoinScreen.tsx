import { FormEvent, useState } from 'react';
import { CALLSIGN_REGEX } from '../config';

interface JoinScreenProps {
  onJoin: (callsign: string) => void;
}

export function JoinScreen({ onJoin }: JoinScreenProps) {
  const [callsign, setCallsign] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = callsign.trim();
    if (!CALLSIGN_REGEX.test(trimmed)) {
      setError('Letters, numbers, and underscores only (1–20 chars)');
      return;
    }
    onJoin(trimmed);
  };

  return (
    <main className="join-screen">
      <div className="join-card">
        {/* Logo */}
        <div className="join-logo" aria-hidden="true">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
            <path
              d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Header */}
        <div className="join-header">
          <h1 className="join-title">AnonChat</h1>
          <p className="join-subtitle">Anonymous real-time chat</p>
        </div>

        {/* Form */}
        <form className="join-form" onSubmit={handleSubmit} noValidate>
          <label className="join-label" htmlFor="callsign-input">
            Enter your callsign
          </label>
          <input
            id="callsign-input"
            className={`join-input${error ? ' join-input--error' : ''}`}
            type="text"
            placeholder="ghost_rider_42"
            value={callsign}
            onChange={(e) => {
              setCallsign(e.target.value);
              if (error) setError('');
            }}
            maxLength={20}
            autoComplete="off"
            autoFocus
            aria-describedby="callsign-hint callsign-error"
            aria-invalid={!!error}
          />
          <p id="callsign-hint" className="join-hint">
            Letters, numbers, and underscores only (max 20 chars)
          </p>
          {error && (
            <p id="callsign-error" className="join-error" role="alert">
              {error}
            </p>
          )}
          <button className="join-btn" type="submit">
            Join Chat
          </button>
        </form>

        <p className="join-footer">
          No account needed. Just pick a name and start chatting.
        </p>
      </div>
    </main>
  );
}
