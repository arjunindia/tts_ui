import React, { useState, useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { HomeScreen } from './src/screens/HomeScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import ttsEngine, { SupertonicTTS } from './src/utils/ttsEngine';
import { Voice } from './src/types';

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

export default function App() {
  const [selectedVoice, setSelectedVoice] = useState<Voice>(VOICES[0]);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [currentScreen, setCurrentScreen] = useState<'home' | 'chat'>('home');

  // Initialize TTS on app start
  useEffect(() => {
    initializeTTS();
  }, []);

  const initializeTTS = async () => {
    try {
      setError(null);
      
      // Check if model is already cached
      const isLoaded = ttsEngine.isLoaded();
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

  const handleBackToHome = useCallback(() => {
    setCurrentScreen('home');
  }, []);

  // Render home screen
  if (currentScreen === 'home') {
    return (
      <HomeScreen
        voices={VOICES}
        selectedVoice={selectedVoice}
        onSelectVoice={handleSelectVoice}
        onStartChat={handleStartChat}
        isModelLoaded={isModelLoaded}
        isDownloading={isDownloading}
        downloadProgress={downloadProgress}
        error={error}
        onRetry={initializeTTS}
      />
    );
  }

  // Render chat screen
  return (
    <ChatScreen
      voice={selectedVoice}
      onBack={handleBackToHome}
    />
  );
}
