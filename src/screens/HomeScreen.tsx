import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Voice } from '../types';
import { pinterestColors, pinterestSpacing, pinterestTypography } from '../theme/pinterest';

const CRASH_LOG_PATH = (FileSystem.documentDirectory ?? '') + 'crash.log';

interface HomeScreenProps {
  voices: Voice[];
  selectedVoice: Voice;
  onSelectVoice: (voice: Voice) => void;
  onStartChat: () => void;
  isModelLoaded: boolean;
  isDownloading: boolean;
  downloadProgress: number;
  error: string | null;
  onRetry: () => void;
}

export function HomeScreen({
  voices,
  selectedVoice,
  onSelectVoice,
  onStartChat,
  isModelLoaded,
  isDownloading,
  downloadProgress,
  error,
  onRetry,
}: HomeScreenProps) {
  const [crashLog, setCrashLog] = useState<string | null>(null);
  const maleVoices = voices.filter(v => v.gender === 'male');
  const femaleVoices = voices.filter(v => v.gender === 'female');

  // Read crash.log on mount — shows previous session's errors
  useEffect(() => {
    FileSystem.readAsStringAsync(CRASH_LOG_PATH, {
      encoding: FileSystem.EncodingType.UTF8,
    })
      .then(content => {
        if (content.trim()) setCrashLog(content.trim());
      })
      .catch(() => {});
  }, []);

  const handleClearCrashLog = useCallback(async () => {
    try {
      await FileSystem.deleteAsync(CRASH_LOG_PATH, { idempotent: true });
      setCrashLog(null);
    } catch {}
  }, []);

  const handleShareCrashLog = useCallback(async () => {
    if (!crashLog) return;
    try {
      await Share.share({ message: `TTS UI Crash Log:\n\n${crashLog}` });
    } catch {}
  }, [crashLog]);

  const handleStartChat = () => {
    if (!isModelLoaded) {
      Alert.alert(
        'Model Not Ready',
        'Please wait for the TTS model to finish downloading.',
        [{ text: 'OK' }]
      );
      return;
    }
    onStartChat();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Crash Log Banner — shows errors from the previous session */}
      {crashLog && (
        <View style={styles.crashBanner}>
          <View style={styles.crashBannerHeader}>
            <Text style={styles.crashBannerTitle}>⚠️ Previous Session Crashed</Text>
            <TouchableOpacity onPress={handleClearCrashLog}>
              <Text style={styles.crashBannerDismiss}>Dismiss</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.crashLogScroll} nestedScrollEnabled>
            <Text style={styles.crashLogText}>{crashLog}</Text>
          </ScrollView>
          <TouchableOpacity style={styles.shareButton} onPress={handleShareCrashLog}>
            <Text style={styles.shareButtonText}>Share / Copy Log</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Voice Chat</Text>
        <Text style={styles.subtitle}>Select a voice and start chatting</Text>
      </View>

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Download Progress */}
      {isDownloading && (
        <View style={styles.progressContainer}>
          <ActivityIndicator size="small" color={pinterestColors.primary} />
          <Text style={styles.progressText}>
            Downloading TTS Model... {Math.round(downloadProgress * 100)}%
          </Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${downloadProgress * 100}%` }]} />
          </View>
        </View>
      )}

      {/* Male Voices */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Male Voices</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.voiceList}>
          {maleVoices.map((voice) => (
            <TouchableOpacity
              key={voice.id}
              style={[
                styles.voiceCard,
                selectedVoice.id === voice.id && styles.selectedVoiceCard,
              ]}
              onPress={() => onSelectVoice(voice)}
            >
              <Text style={styles.voiceEmoji}>👨</Text>
              <Text style={[
                styles.voiceName,
                selectedVoice.id === voice.id && styles.selectedVoiceName,
              ]}>
                {voice.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Female Voices */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Female Voices</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.voiceList}>
          {femaleVoices.map((voice) => (
            <TouchableOpacity
              key={voice.id}
              style={[
                styles.voiceCard,
                selectedVoice.id === voice.id && styles.selectedVoiceCard,
              ]}
              onPress={() => onSelectVoice(voice)}
            >
              <Text style={styles.voiceEmoji}>👩</Text>
              <Text style={[
                styles.voiceName,
                selectedVoice.id === voice.id && styles.selectedVoiceName,
              ]}>
                {voice.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Selected Voice Info */}
      <View style={styles.selectedInfo}>
        <Text style={styles.selectedLabel}>Selected Voice:</Text>
        <Text style={styles.selectedValue}>
          {selectedVoice.name} ({selectedVoice.gender})
        </Text>
      </View>

      {/* Start Chat Button */}
      <TouchableOpacity
        style={[
          styles.startButton,
          (!isModelLoaded || isDownloading) && styles.startButtonDisabled,
        ]}
        onPress={handleStartChat}
        disabled={!isModelLoaded || isDownloading}
      >
        <Text style={styles.startButtonText}>
          {isDownloading ? 'Downloading...' : 'Start Chat'}
        </Text>
      </TouchableOpacity>

      {/* Status */}
      <View style={styles.statusContainer}>
        <View style={[styles.statusDot, isModelLoaded ? styles.statusDotGreen : styles.statusDotYellow]} />
        <Text style={styles.statusText}>
          {isModelLoaded ? 'Ready' : isDownloading ? 'Downloading...' : 'Initializing...'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: pinterestColors.canvas,
  },
  header: {
    paddingHorizontal: pinterestSpacing.lg,
    paddingTop: pinterestSpacing.xl,
    paddingBottom: pinterestSpacing.lg,
  },
  title: {
    ...pinterestTypography.headline,
    color: pinterestColors.ink,
    marginBottom: pinterestSpacing.xs,
  },
  subtitle: {
    ...pinterestTypography.body,
    color: pinterestColors.mute,
  },
  errorContainer: {
    marginHorizontal: pinterestSpacing.lg,
    padding: pinterestSpacing.md,
    backgroundColor: '#FFEBEE',
    borderRadius: pinterestSpacing.sm,
    marginBottom: pinterestSpacing.md,
  },
  errorText: {
    color: '#C62828',
    marginBottom: pinterestSpacing.sm,
  },
  retryButton: {
    alignSelf: 'flex-start',
    paddingVertical: pinterestSpacing.xs,
    paddingHorizontal: pinterestSpacing.md,
    backgroundColor: '#C62828',
    borderRadius: pinterestSpacing.xs,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  progressContainer: {
    marginHorizontal: pinterestSpacing.lg,
    padding: pinterestSpacing.md,
    backgroundColor: pinterestColors.surface,
    borderRadius: pinterestSpacing.sm,
    marginBottom: pinterestSpacing.md,
    alignItems: 'center',
  },
  progressText: {
    marginTop: pinterestSpacing.sm,
    ...pinterestTypography.caption,
    color: pinterestColors.mute,
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: pinterestColors.hairline,
    borderRadius: 3,
    marginTop: pinterestSpacing.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: pinterestColors.primary,
  },
  section: {
    paddingHorizontal: pinterestSpacing.lg,
    marginBottom: pinterestSpacing.lg,
  },
  sectionTitle: {
    ...pinterestTypography.subhead,
    color: pinterestColors.ink,
    marginBottom: pinterestSpacing.md,
  },
  voiceList: {
    flexDirection: 'row',
  },
  voiceCard: {
    width: 100,
    paddingVertical: pinterestSpacing.md,
    paddingHorizontal: pinterestSpacing.sm,
    backgroundColor: pinterestColors.surface,
    borderRadius: pinterestSpacing.sm,
    marginRight: pinterestSpacing.sm,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedVoiceCard: {
    borderColor: pinterestColors.primary,
    backgroundColor: pinterestColors['primary-light'],
  },
  voiceEmoji: {
    fontSize: 32,
    marginBottom: pinterestSpacing.xs,
  },
  voiceName: {
    ...pinterestTypography.caption,
    color: pinterestColors.ink,
    fontWeight: '500',
  },
  selectedVoiceName: {
    color: pinterestColors.primary,
    fontWeight: '700',
  },
  selectedInfo: {
    marginHorizontal: pinterestSpacing.lg,
    padding: pinterestSpacing.md,
    backgroundColor: pinterestColors.surface,
    borderRadius: pinterestSpacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: pinterestSpacing.lg,
  },
  selectedLabel: {
    ...pinterestTypography.body,
    color: pinterestColors.mute,
  },
  selectedValue: {
    ...pinterestTypography.body,
    color: pinterestColors.primary,
    fontWeight: '600',
  },
  startButton: {
    marginHorizontal: pinterestSpacing.lg,
    paddingVertical: pinterestSpacing.md,
    backgroundColor: pinterestColors.primary,
    borderRadius: pinterestSpacing.sm,
    alignItems: 'center',
    marginBottom: pinterestSpacing.lg,
  },
  startButtonDisabled: {
    backgroundColor: pinterestColors.ash,
  },
  startButtonText: {
    ...pinterestTypography.button,
    color: pinterestColors['on-primary'],
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: pinterestSpacing.lg,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: pinterestSpacing.xs,
  },
  statusDotGreen: {
    backgroundColor: '#4CAF50',
  },
  statusDotYellow: {
    backgroundColor: '#FFC107',
  },
  statusText: {
    ...pinterestTypography.caption,
    color: pinterestColors.mute,
  },
  // ── Crash log banner ──────────────────────────────────────────────────────
  crashBanner: {
    marginHorizontal: pinterestSpacing.lg,
    marginTop: pinterestSpacing.md,
    backgroundColor: '#FFF3E0',
    borderRadius: pinterestSpacing.sm,
    borderWidth: 1,
    borderColor: '#FF6B00',
    padding: pinterestSpacing.md,
    maxHeight: 240,
  },
  crashBannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: pinterestSpacing.sm,
  },
  crashBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#BF360C',
  },
  crashBannerDismiss: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF6B00',
  },
  crashLogScroll: {
    maxHeight: 120,
    backgroundColor: '#FFF8F0',
    borderRadius: 4,
    padding: pinterestSpacing.sm,
    marginBottom: pinterestSpacing.sm,
  },
  crashLogText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#4E342E',
    lineHeight: 16,
  },
  shareButton: {
    backgroundColor: '#FF6B00',
    borderRadius: pinterestSpacing.xs,
    paddingVertical: pinterestSpacing.xs,
    paddingHorizontal: pinterestSpacing.md,
    alignSelf: 'flex-end',
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
