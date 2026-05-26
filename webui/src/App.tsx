import { useState } from 'react';
import { JoinScreen } from './components/JoinScreen';
import { ChatScreen } from './components/ChatScreen';

export default function App() {
  const [screen, setScreen] = useState<'join' | 'chat'>('join');
  const [callsign, setCallsign] = useState('');

  const handleJoin = (cs: string) => {
    setCallsign(cs);
    setScreen('chat');
  };

  const handleLeave = () => {
    setCallsign('');
    setScreen('join');
  };

  if (screen === 'chat') {
    return <ChatScreen callsign={callsign} onLeave={handleLeave} />;
  }
  return <JoinScreen onJoin={handleJoin} />;
}
