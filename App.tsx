import React, { useState, useCallback } from 'react';
import { HomeScreen } from './src/screens/HomeScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { Message, Voice } from './src/types';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'home' | 'chat'>('home');
  const [selectedVoice, setSelectedVoice] = useState<Voice | null>(null);
  const [allMessages, setAllMessages] = useState<Record<string, Message[]>>({});
  const [lastMessages, setLastMessages] = useState<Map<string, string>>(new Map());

  const messages = selectedVoice ? (allMessages[selectedVoice.id] || []) : [];

  const handleSelectChat = useCallback((voice: Voice) => {
    setSelectedVoice(voice);
    setCurrentScreen('chat');
  }, []);

  const handleBack = useCallback(() => {
    setCurrentScreen('home');
    setSelectedVoice(null);
  }, []);

  const handleSendMessage = useCallback((text: string) => {
    if (!selectedVoice) return;

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      text,
      status: 'done',
      timestamp: new Date(),
    };

    const assistantMessage: Message = {
      id: `assistant_${Date.now()}`,
      role: 'assistant',
      text,
      status: 'pending',
      timestamp: new Date(),
    };

    setAllMessages(prev => ({
      ...prev,
      [selectedVoice.id]: [...(prev[selectedVoice.id] || []), userMessage, assistantMessage],
    }));

    // Simulate TTS response after delay
    setTimeout(() => {
      setAllMessages(prev => ({
        ...prev,
        [selectedVoice.id]: prev[selectedVoice.id].map(msg =>
          msg.id === assistantMessage.id
            ? { ...msg, audioUri: 'mock://audio', status: 'done' }
            : msg
        ),
      }));
    }, 2000);
  }, [selectedVoice]);

  const handleRetry = useCallback((message: Message) => {
    if (!selectedVoice) return;

    setAllMessages(prev => ({
      ...prev,
      [selectedVoice.id]: prev[selectedVoice.id].map(msg =>
        msg.id === message.id
          ? { ...msg, status: 'pending', audioUri: undefined }
          : msg
      ),
    }));

    // Simulate retry after delay
    setTimeout(() => {
      setAllMessages(prev => ({
        ...prev,
        [selectedVoice.id]: prev[selectedVoice.id].map(msg =>
          msg.id === message.id
            ? { ...msg, audioUri: 'mock://audio', status: 'done' }
            : msg
        ),
      }));
    }, 2000);
  }, [selectedVoice]);

  const handleUpdateLastMessage = useCallback((text: string) => {
    if (!selectedVoice) return;
    setLastMessages(prev => {
      const next = new Map(prev);
      next.set(selectedVoice.id, text);
      return next;
    });
  }, [selectedVoice]);

  if (currentScreen === 'chat' && selectedVoice) {
    return (
      <ChatScreen
        voice={selectedVoice}
        messages={messages}
        onSendMessage={handleSendMessage}
        onRetry={handleRetry}
        onUpdateLastMessage={handleUpdateLastMessage}
        onBack={handleBack}
      />
    );
  }

  return (
    <HomeScreen
      onSelectChat={handleSelectChat}
      lastMessages={lastMessages}
    />
  );
}