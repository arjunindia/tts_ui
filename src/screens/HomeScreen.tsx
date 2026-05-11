import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Voice, Message } from '../types';
import { pinterestColors, pinterestSpacing, pinterestRounded, pinterestTypography } from '../theme/pinterest';
import { Avatar } from '../components/Avatar';

const CRASH_LOG_PATH = (FileSystem.documentDirectory ?? '') + 'crash.log';

interface HomeScreenProps {
  voices: Voice[];
  selectedVoice: Voice;
  onSelectVoice: (voice: Voice) => void;
  onStartChat: () => void;
  onOpenChat: (voice: Voice) => void;
  isModelLoaded: boolean;
  isDownloading: boolean;
  downloadProgress: number;
  error: string | null;
  onRetry: () => void;
  messageHistory: Record<string, Message[]>;
}

function getLastMessage(voiceId: string, history: Record<string, Message[]>): Message | null {
  const msgs = history[voiceId];
  if (!msgs || msgs.length === 0) return null;
  // Get the last user message (what the user typed)
  const userMsgs = msgs.filter(m => m.role === 'user');
  return userMsgs.length > 0 ? userMsgs[userMsgs.length - 1] : null;
}

function formatTimestamp(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (days === 1) {
    return 'Yesterday';
  } else if (days < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

function formatMessagePreview(text: string): string {
  if (!text) return 'No messages yet';
  return text.length > 50 ? text.substring(0, 50).trim() + '…' : text;
}

interface ContactItemProps {
  voice: Voice;
  lastMessage: Message | null;
  isSelected: boolean;
  onPress: () => void;
}

function ContactItem({ voice, lastMessage, isSelected, onPress }: ContactItemProps) {
  return (
    <TouchableOpacity
      style={[styles.contactItem, isSelected && styles.contactItemSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Avatar */}
      <Avatar voice={voice} size={52} />

      {/* Name + message preview */}
      <View style={styles.contactInfo}>
        <View style={styles.contactTopRow}>
          <Text style={styles.contactName} numberOfLines={1}>
            {voice.name}
          </Text>
          {lastMessage && (
            <Text style={styles.contactTime}>
              {formatTimestamp(lastMessage.timestamp)}
            </Text>
          )}
        </View>
        <View style={styles.contactBottomRow}>
          <Text
            style={[
              styles.contactPreview,
              !lastMessage && styles.contactPreviewEmpty,
            ]}
            numberOfLines={1}
          >
            {lastMessage
              ? `You: ${formatMessagePreview(lastMessage.text)}`
              : `Tap to start a conversation →`}
          </Text>
          {/* Unread indicator dot (subtle) */}
          {!lastMessage && (
            <View style={styles.newBadge} />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function HomeScreen({
  voices,
  selectedVoice,
  onSelectVoice,
  onStartChat,
  onOpenChat,
  isModelLoaded,
  isDownloading,
  downloadProgress,
  error,
  onRetry,
  messageHistory,
}: HomeScreenProps) {
  const [crashLog, setCrashLog] = useState<string | null>(null);

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

  const handleContactPress = (voice: Voice) => {
    onSelectVoice(voice);
    onOpenChat(voice);
  };

  const renderContact = ({ item }: { item: Voice }) => {
    const lastMsg = getLastMessage(item.id, messageHistory);
    return (
      <ContactItem
        voice={item}
        lastMessage={lastMsg}
        isSelected={selectedVoice.id === item.id}
        onPress={() => handleContactPress(item)}
      />
    );
  };

  const renderListHeader = () => (
    <>
      {/* Crash Log Banner */}
      {crashLog && (
        <View style={styles.crashBanner}>
          <View style={styles.crashBannerHeader}>
            <Text style={styles.crashBannerTitle}>⚠️ Previous Session Crashed</Text>
            <TouchableOpacity onPress={handleClearCrashLog}>
              <Text style={styles.crashBannerDismiss}>Dismiss</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.crashLogScroll}>
            <Text style={styles.crashLogText}>{crashLog}</Text>
          </View>
          <TouchableOpacity style={styles.shareButton} onPress={handleShareCrashLog}>
            <Text style={styles.shareButtonText}>Share / Copy Log</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Model status banner */}
      {(isDownloading || error || !isModelLoaded) && (
        <View style={styles.statusBanner}>
          {isDownloading && (
            <>
              <ActivityIndicator size="small" color={pinterestColors.primary} />
              <Text style={styles.statusBannerText}>
                Downloading TTS Model… {Math.round(downloadProgress * 100)}%
              </Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${downloadProgress * 100}%` }]} />
              </View>
            </>
          )}
          {error && !isDownloading && (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={18} color={pinterestColors.destructive} />
              <Text style={styles.errorBannerText}>{error}</Text>
              <TouchableOpacity style={styles.retryBadge} onPress={onRetry}>
                <Text style={styles.retryBadgeText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
          {!isModelLoaded && !isDownloading && !error && (
            <View style={styles.errorRow}>
              <ActivityIndicator size="small" color={pinterestColors.mute} />
              <Text style={styles.statusBannerText}>Initializing TTS engine…</Text>
            </View>
          )}
        </View>
      )}
    </>
  );

  const renderListFooter = () => {
    if (isModelLoaded) {
      return (
        <View style={styles.readyFooter}>
          <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
          <Text style={styles.readyText}>TTS engine ready</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      {/* App Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Voice Chat</Text>
        <View style={styles.headerRight}>
          <Ionicons
            name="chatbubbles"
            size={24}
            color={pinterestColors.primary}
          />
        </View>
      </View>

      {/* Divider */}
      <View style={styles.headerDivider} />

      {/* Contact List */}
      <FlatList
        data={voices}
        renderItem={renderContact}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderListHeader}
        ListFooterComponent={renderListFooter}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: pinterestColors.canvas,
  },
  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: pinterestSpacing.lg,
    paddingVertical: pinterestSpacing.md,
    backgroundColor: pinterestColors.canvas,
  },
  headerTitle: {
    ...pinterestTypography.headline,
    color: pinterestColors.ink,
  },
  headerRight: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: pinterestColors['primary-light'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerDivider: {
    height: 1,
    backgroundColor: pinterestColors.hairline,
  },
  // ── List ───────────────────────────────────────────────────────────────────
  listContent: {
    flexGrow: 1,
  },
  separator: {
    height: 1,
    backgroundColor: pinterestColors.hairline,
    marginLeft: 68, // avatar center + margin
  },
  // ── Contact Item ────────────────────────────────────────────────────────────
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: pinterestSpacing.md,
    paddingHorizontal: pinterestSpacing.lg,
    backgroundColor: pinterestColors.canvas,
  },
  contactItemSelected: {
    backgroundColor: pinterestColors['primary-light'],
  },
  contactInfo: {
    flex: 1,
    marginLeft: pinterestSpacing.md,
    overflow: 'hidden',
  },
  contactTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  contactName: {
    ...pinterestTypography.body,
    fontWeight: '600',
    color: pinterestColors.ink,
    flex: 1,
    marginRight: pinterestSpacing.sm,
  },
  contactTime: {
    ...pinterestTypography.caption,
    color: pinterestColors.mute,
  },
  contactBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactPreview: {
    ...pinterestTypography.body,
    color: pinterestColors.mute,
    flex: 1,
  },
  contactPreviewEmpty: {
    color: pinterestColors.ash,
    fontStyle: 'italic',
  },
  newBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: pinterestColors.primary,
    marginLeft: pinterestSpacing.sm,
  },
  // ── Status Banner ───────────────────────────────────────────────────────────
  statusBanner: {
    marginHorizontal: pinterestSpacing.lg,
    marginTop: pinterestSpacing.md,
    marginBottom: pinterestSpacing.sm,
    padding: pinterestSpacing.md,
    backgroundColor: pinterestColors['surface-card'],
    borderRadius: pinterestRounded.md,
    alignItems: 'center',
  },
  statusBannerText: {
    ...pinterestTypography.caption,
    color: pinterestColors.mute,
    marginTop: pinterestSpacing.xs,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pinterestSpacing.sm,
  },
  errorBannerText: {
    ...pinterestTypography.caption,
    color: pinterestColors.destructive,
    flex: 1,
  },
  retryBadge: {
    backgroundColor: pinterestColors.primary,
    borderRadius: pinterestRounded.full,
    paddingHorizontal: pinterestSpacing.md,
    paddingVertical: pinterestSpacing.xs,
  },
  retryBadgeText: {
    ...pinterestTypography.button,
    color: pinterestColors['on-primary'],
    fontSize: 12,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: pinterestColors.hairline,
    borderRadius: 2,
    marginTop: pinterestSpacing.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: pinterestColors.primary,
    borderRadius: 2,
  },
  // ── Ready Footer ────────────────────────────────────────────────────────────
  readyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: pinterestSpacing.md,
    gap: pinterestSpacing.xs,
  },
  readyText: {
    ...pinterestTypography.caption,
    color: '#4CAF50',
  },
  // ── Crash log banner ───────────────────────────────────────────────────────
  crashBanner: {
    marginHorizontal: pinterestSpacing.lg,
    marginTop: pinterestSpacing.md,
    backgroundColor: '#FFF3E0',
    borderRadius: pinterestRounded.md,
    borderWidth: 1,
    borderColor: '#FF6B00',
    padding: pinterestSpacing.md,
  },
  crashBannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: pinterestSpacing.sm,
  },
  crashBannerTitle: {
    ...pinterestTypography.body,
    fontWeight: '700',
    color: '#BF360C',
  },
  crashBannerDismiss: {
    ...pinterestTypography.body,
    fontWeight: '600',
    color: '#FF6B00',
  },
  crashLogScroll: {
    maxHeight: 120,
    backgroundColor: '#FFF8F0',
    borderRadius: pinterestRounded.sm,
    padding: pinterestSpacing.sm,
    marginBottom: pinterestSpacing.sm,
  },
  crashLogText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#4E342E',
    lineHeight: 16,
  },
  shareButton: {
    backgroundColor: '#FF6B00',
    borderRadius: pinterestRounded.sm,
    paddingVertical: pinterestSpacing.xs,
    paddingHorizontal: pinterestSpacing.md,
    alignSelf: 'flex-end',
  },
  shareButtonText: {
    color: '#FFFFFF',
    ...pinterestTypography.button,
    fontSize: 13,
  },
});
