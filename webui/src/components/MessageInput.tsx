import { KeyboardEvent, useState } from 'react';
import { MAX_MESSAGE_LENGTH } from '../config';

interface MessageInputProps {
  onSend: (text: string) => void;
  disabled: boolean;
}

export function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [text, setText] = useState('');

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="msg-input-bar">
      <input
        className="msg-input"
        type="text"
        placeholder="Type a message..."
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-label="Message"
        autoComplete="off"
      />
      <button
        className="send-btn"
        onClick={handleSend}
        disabled={disabled || !text.trim()}
        aria-label="Send message"
      >
        {/* Paper-plane icon */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M22 2L11 13"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M22 2L15 22L11 13L2 9L22 2Z"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
