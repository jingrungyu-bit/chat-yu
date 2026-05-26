import { useCallback, useState } from 'react';
import { ServerMessage } from '../types';
import { MAX_RETRY_ATTEMPTS } from '../config';
import { useWebSocket } from '../hooks/useWebSocket';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { StatusIndicator } from './StatusIndicator';

interface ChatScreenProps {
  callsign: string;
  onLeave: () => void;
}

export function ChatScreen({ callsign, onLeave }: ChatScreenProps) {
  const [messages, setMessages] = useState<ServerMessage[]>([]);
  // Start at 1 (self); increment/decrement on system events from server
  const [onlineCount, setOnlineCount] = useState(1);

  const handleMessage = useCallback((msg: ServerMessage) => {
    setMessages((prev) => [...prev, msg]);
    if (msg.type === 'system') {
      setOnlineCount((n) =>
        msg.event === 'user_joined' ? n + 1 : Math.max(1, n - 1),
      );
    }
  }, []);

  const { status, failedAttempts, sendMessage, disconnect, reconnect } =
    useWebSocket(callsign, handleMessage);

  const handleLeave = () => {
    disconnect();
    onLeave();
  };

  const connectionLost = failedAttempts > MAX_RETRY_ATTEMPTS;
  const canSend = status === 'connected';

  return (
    <div className="chat-wrapper">
      <div className="chat-screen">
        {/* Header */}
        <header className="chat-header">
          <span className="chat-brand">AnonChat</span>
          <StatusIndicator status={status} />
          <span className="chat-online">{onlineCount} online</span>
          <div className="chat-spacer" />
          <button className="chat-leave-btn" onClick={handleLeave} aria-label="Leave chat">
            <span className="leave-long">Leave Chat</span>
            <span className="leave-short">Leave</span>
          </button>
        </header>

        {/* Messages */}
        <MessageList messages={messages} myCallsign={callsign} />

        {/* Reconnect banner — shown after all retries exhausted */}
        {connectionLost && (
          <div className="reconnect-banner" role="alert">
            <span>Connection lost</span>
            <button className="reconnect-btn" onClick={reconnect}>
              Reconnect
            </button>
          </div>
        )}

        {/* Input */}
        <MessageInput onSend={sendMessage} disabled={!canSend} />
      </div>
    </div>
  );
}
