import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { HomeScreen } from './src/screens/HomeScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { Message, Voice } from './src/types';
import { initTTS, getTTS, loadVoiceStyle, writeWavFile, TTS_BASE_PATH, TextToSpeech, Style } from './src/utils/ttsEngine';
import * as FileSystem from 'expo-file-system';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'home' | 'chat'>('home');
  const [selectedVoice, setSelectedVoice] = useState<Voice | null>(null);
  const [allMessages, setAllMessages] = useState<Record<string, Message[]>>({});
  const [lastMessages, setLastMessages] = useState<Map<string, string>>(new Map());
  const [ttsReady, setTtsReady] = useState(false);
  const [ttsLoading, setTtsLoading] = useState('Loading TTS engine...');
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  
  const ttsRef = useRef<TextToSpeech | null>(null);
  const voiceStylesRef = useRef<Map<string, Style>>(new Map());
  const soundRef = useRef<Audio.Sound | null>(null);

  // Initialize TTS engine
  useEffect(() => {
    const init = async () => {
      try {
        await initTTS(TTS_BASE_PATH, (name, current, total) => {
          setTtsLoading(`Loading ${name}... (${current}/${total})`);
        });
        ttsRef.current = getTTS();
        
        // Pre-load all voice styles
        const { VOICES } = await import('./src/data/voices');
        setTtsLoading('Loading voice styles...');
        for (const voice of VOICES) {
          const style = await loadVoiceStyle(`../assets/supertonic/voice_styles/${voice.id}.json`);
          voiceStylesRef.current.set(voice.id, style);
        }
        
        setTtsReady(true);
        setTtsLoading('');
      } catch (error) {
        console.error('Failed to init TTS:', error);
        setTtsLoading('Failed to load TTS engine');
      }
    };
    init();
  }, []);

  const handleSelectChat = useCallback((voice: Voice) => {
    setSelectedVoice(voice);
    setCurrentScreen('chat');
  }, []);

  const handleBack = useCallback(() => {
    setCurrentScreen('home');
    setSelectedVoice(null);
  }, []);

  const handleSendMessage = useCallback(async (text: string) => {
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

    // Generate TTS in background
    const generateTTS = async () => {
      const tts = ttsRef.current;
      const style = voiceStylesRef.current.get(selectedVoice.id);
      
      if (!tts || !style) {
        setAllMessages(prev => ({
          ...prev,
          [selectedVoice.id]: prev[selectedVoice.id].map(msg =>
            msg.id === assistantMessage.id ? { ...msg, status: 'error' } : msg
          ),
        }));
        return;
      }

      try {
        const { wav, duration } = await tts.call(text, 'en', style, 8, 1.05, 0.3);
        
        // Write WAV file to cache
        const wavBuffer = writeWavFile(wav, tts.sampleRate);
        const base64 = btoa(String.fromCharCode(...new Uint8Array(wavBuffer)));
        const fileUri = `${FileSystem.cacheDirectory}tts_${Date.now()}.wav`;
        await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
        
        setAllMessages(prev => ({
          ...prev,
          [selectedVoice.id]: prev[selectedVoice.id].map(msg =>
            msg.id === assistantMessage.id ? { ...msg, audioUri: fileUri, status: 'done' } : msg
          ),
        }));
      } catch (error) {
        console.error('TTS error:', error);
        setAllMessages(prev => ({
          ...prev,
          [selectedVoice.id]: prev[selectedVoice.id].map(msg =>
            msg.id === assistantMessage.id ? { ...msg, status: 'error' } : msg
          ),
        }));
      }
    };

    generateTTS();
  }, [selectedVoice]);

  const handleRetry = useCallback(async (message: Message) => {
    if (!selectedVoice) return;

    setAllMessages(prev => ({
      ...prev,
      [selectedVoice.id]: prev[selectedVoice.id].map(msg =>
        msg.id === message.id ? { ...msg, status: 'pending', audioUri: undefined } : msg
      ),
    }));

    const tts = ttsRef.current;
    const style = voiceStylesRef.current.get(selectedVoice.id);
    
    if (!tts || !style) return;

    try {
      const { wav } = await tts.call(message.text, 'en', style, 8, 1.05, 0.3);
      const wavBuffer = writeWavFile(wav, tts.sampleRate);
      const base64 = btoa(String.fromCharCode(...new Uint8Array(wavBuffer)));
      const fileUri = `${FileSystem.cacheDirectory}tts_${Date.now()}.wav`;
      await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
      
      setAllMessages(prev => ({
        ...prev,
        [selectedVoice.id]: prev[selectedVoice.id].map(msg =>
          msg.id === message.id ? { ...msg, audioUri: fileUri, status: 'done' } : msg
        ),
      }));
    } catch (error) {
      setAllMessages(prev => ({
        ...prev,
        [selectedVoice.id]: prev[selectedVoice.id].map(msg =>
          msg.id === message.id ? { ...msg, status: 'error' } : msg
        ),
      }));
    }
  }, [selectedVoice]);

  const handleUpdateLastMessage = useCallback((text: string) => {
    if (!selectedVoice) return;
    setLastMessages(prev => {
      const next = new Map(prev);
      next.set(selectedVoice.id, text);
      return next;
    });
  }, [selectedVoice]);

  const handlePlayAudio = useCallback(async (messageId: string, audioUri?: string) => {
    if (!audioUri) return;
    
    // If same message is playing, stop it
    if (currentlyPlayingId === messageId && soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
      setCurrentlyPlayingId(null);
      return;
    }
    
    // Stop any currently playing sound
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
    }
    
    // Load and play new sound
    const { sound } = await Audio.Sound.createAsync({ uri: audioUri });
    soundRef.current = sound;
    setCurrentlyPlayingId(messageId);
    
    await sound.playAsync();
    
    // When playback finishes, reset state
    sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
      if (status.isLoaded && status.didJustFinish) {
        setCurrentlyPlayingId(null);
      }
    });
  }, [currentlyPlayingId]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  // Show loading screen while TTS initializes
  if (!ttsReady) {
    return (
      <HomeScreen
        onSelectChat={() => {}}
        lastMessages={new Map()}
        loadingMessage={ttsLoading}
      />
    );
  }

  if (currentScreen === 'chat' && selectedVoice) {
    return (
      <ChatScreen
        voice={selectedVoice}
        messages={(allMessages[selectedVoice.id] || []).map(msg => ({
          ...msg,
          status: msg.id === currentlyPlayingId ? 'playing' : msg.status,
        }))}
        onSendMessage={handleSendMessage}
        onRetry={handleRetry}
        onUpdateLastMessage={handleUpdateLastMessage}
        onBack={handleBack}
        onPlayAudio={handlePlayAudio}
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
