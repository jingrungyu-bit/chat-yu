import { useEffect, useRef } from 'react';
import { ServerMessage } from '../types';
import { MessageItem } from './MessageItem';

interface MessageListProps {
  messages: ServerMessage[];
  myCallsign: string;
}

export function MessageList({ messages, myCallsign }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div className="message-list" role="log" aria-label="Chat messages" aria-live="polite">
      {messages.length === 0 && (
        <p className="message-list-empty">No messages yet. Say hello!</p>
      )}
      {messages.map((msg, i) => (
        <MessageItem key={i} message={msg} myCallsign={myCallsign} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
