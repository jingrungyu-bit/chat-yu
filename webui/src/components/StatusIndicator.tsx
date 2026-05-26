import { ConnectionStatus } from '../types';

interface StatusIndicatorProps {
  status: ConnectionStatus;
}

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  connected: 'Connected',
  connecting: 'Connecting...',
  reconnecting: 'Reconnecting...',
  disconnected: 'Disconnected',
};

export function StatusIndicator({ status }: StatusIndicatorProps) {
  return (
    <div className="status-indicator" aria-live="polite" aria-atomic="true">
      <div className={`status-dot status-dot--${status}`} />
      <span className={`status-label status-label--${status}`}>
        {STATUS_LABELS[status]}
      </span>
    </div>
  );
}
