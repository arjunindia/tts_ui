import React, { useState, useEffect, useCallback } from 'react';
import { BackHandler } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { HomeScreen } from './src/screens/HomeScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import ttsEngine, { SupertonicTTS } from './src/utils/ttsEngine';
import { Voice, Message } from './src/types';

// Voice configurations - M1-M5 male, F1-F5 female
const VOICES: Voice[] = [
  { id: 'M1', name: 'Marcus', gender: 'male' },
  { id: 'M2', name: 'James', gender: 'male' },
  { id: 'M3', name: 'Alex', gender: 'male' },
  { id: 'M4', name: 'Ryan', gender: 'male' },
  { id: 'M5', name: 'David', gender: 'male' },
  { id: 'F1', name: 'Emma', gender: 'female' },
  { id: 'F2', name: 'Sophia', gender: 'female' },
  { id: 'F3', name: 'Olivia', gender: 'female' },
  { id: 'F4', name: 'Ava', gender: 'female' },
  { id: 'F5', name: 'Isabella', gender: 'female' },
];

const DEFAULT_MODEL_ID = 'model.onnx';

// Per-voice message history for last-message previews on the contact list
type MessageHistory = Record<string, Message[]>;

export default function App() {
  const [selectedVoice, setSelectedVoice] = useState<Voice>(VOICES[0]);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [currentScreen, setCurrentScreen] = useState<'home' | 'chat'>('home');
  const [messageHistory, setMessageHistory] = useState<MessageHistory>({});

  // Handle Android hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (currentScreen === 'chat') {
        setCurrentScreen('home');
        return true; // prevent default
      }
      return false;
    });
    return () => backHandler.remove();
  }, [currentScreen]);

  // Initialize TTS on app start
  useEffect(() => {
    initializeTTS();
  }, []);

  const initializeTTS = async () => {
    try {
      setError(null);

      // Check if model is already cached
      const isLoaded = ttsEngine.isModelLoaded();
      if (isLoaded) {
        setIsModelLoaded(true);
        return;
      }

      // Download model if not cached
      setIsDownloading(true);
      setDownloadProgress(0);

      const success = await ttsEngine.downloadModel(DEFAULT_MODEL_ID, (progress) => {
        setDownloadProgress(progress);
      });

      if (!success) {
        throw new Error('Failed to download model');
      }

      // Load the model
      const loaded = await ttsEngine.loadModel(DEFAULT_MODEL_ID);
      if (!loaded) {
        throw new Error('Failed to load model');
      }

      setIsModelLoaded(true);
    } catch (err) {
      console.error('TTS initialization error:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize TTS');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSelectVoice = useCallback((voice: Voice) => {
    setSelectedVoice(voice);
  }, []);

  const handleStartChat = useCallback(() => {
    setCurrentScreen('chat');
  }, []);

  const handleOpenChat = useCallback((voice: Voice) => {
    setSelectedVoice(voice);
    setCurrentScreen('chat');
  }, []);

  const handleBackToHome = useCallback(() => {
    setCurrentScreen('home');
  }, []);

  // Called by ChatScreen when messages change so HomeScreen can show last-message previews
  const handleMessagesUpdate = useCallback((voiceId: string, messages: Message[]) => {
    setMessageHistory(prev => ({
      ...prev,
      [voiceId]: messages,
    }));
  }, []);

  // Render home screen
  if (currentScreen === 'home') {
    return (
      <HomeScreen
        voices={VOICES}
        selectedVoice={selectedVoice}
        onSelectVoice={handleSelectVoice}
        onStartChat={handleStartChat}
        onOpenChat={handleOpenChat}
        isModelLoaded={isModelLoaded}
        isDownloading={isDownloading}
        downloadProgress={downloadProgress}
        error={error}
        onRetry={initializeTTS}
        messageHistory={messageHistory}
      />
    );
  }

  // Render chat screen
  return (
    <ChatScreen
      voice={selectedVoice}
      onBack={handleBackToHome}
      onMessagesChange={(messages) => handleMessagesUpdate(selectedVoice.id, messages)}
    />
  );
}
