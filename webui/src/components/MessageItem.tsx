import { ServerMessage } from '../types';

interface MessageItemProps {
  message: ServerMessage;
  myCallsign: string;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function MessageItem({ message, myCallsign }: MessageItemProps) {
  if (message.type === 'system') {
    const text =
      message.event === 'user_joined'
        ? `${message.callsign} joined the chat`
        : `${message.callsign} left the chat`;
    return <div className="msg-system">{text}</div>;
  }

  const isOwn = message.callsign === myCallsign;
  const time = formatTime(message.timestamp);

  if (isOwn) {
    return (
      <div className="msg-row msg-row--own">
        <span className="msg-label">You</span>
        <div className="msg-bubble msg-bubble--own">{message.text}</div>
        {time && <span className="msg-time">{time}</span>}
      </div>
    );
  }

  return (
    <div className="msg-row msg-row--other">
      <span className="msg-label">{message.callsign}</span>
      <div className="msg-bubble msg-bubble--other">{message.text}</div>
      {time && <span className="msg-time">{time}</span>}
    </div>
  );
}
