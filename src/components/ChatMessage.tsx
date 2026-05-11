import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { Message } from '../types';
import { pinterestColors, pinterestSpacing, pinterestRounded } from '../theme/pinterest';

interface ChatMessageProps {
  message: Message;
  onPlayAudio: (messageId: string, audioUri?: string) => void;
  onRetry: (message: Message) => void;
}

export function ChatMessage({ message, onPlayAudio, onRetry }: ChatMessageProps) {
  const [showRetryModal, setShowRetryModal] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);

  const isUser = message.role === 'user';
  const isPending = message.status === 'pending';
  const isError = message.status === 'error';
  const isPlaying = message.status === 'playing';
  const isDone = message.status === 'done';

  const handlePress = () => {
    if (isLongPress.current) {
      isLongPress.current = false;
      return;
    }
    
    if (isUser || isPending || isError) return;
    if (!message.audioUri) return;
    
    onPlayAudio(message.id, message.audioUri);
  };

  const handlePressIn = () => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setShowRetryModal(true);
    }, 500);
  };

  const handlePressOut = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleRetry = () => {
    setShowRetryModal(false);
    onRetry(message);
  };

  return (
    <>
      <View style={[styles.container, isUser ? styles.userContainer : styles.assistantContainer]}>
        {isUser ? (
          <View style={styles.bubbleRow}>
            <TouchableOpacity
              style={[styles.bubble, styles.userBubble]}
              onPress={handlePress}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              activeOpacity={0.8}
            >
              <Text style={styles.userText}>{message.text}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.bubbleRow}>
            <TouchableOpacity
              style={[
                styles.bubble,
                styles.assistantBubble,
                isPending && styles.pendingBubble,
                isError && styles.errorBubble,
                isDone && message.audioUri && styles.voiceBubble,
              ]}
              onPress={handlePress}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              activeOpacity={0.8}
              disabled={isUser || isPending}
            >
              {isPending ? (
                <View style={styles.pendingContainer}>
                  <Text style={styles.pendingText}>Generating audio...</Text>
                </View>
              ) : isError ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>⚠️ Failed to generate</Text>
                </View>
              ) : (
                <View style={styles.voicePlayerContainer}>
                  <View style={styles.playButton}>
                    <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
                  </View>
                  <View style={styles.voicePlayerRight}>
                    <Text style={styles.voiceStatus}>
                      {isPlaying ? 'Playing...' : 'Tap to play'}
                    </Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Modal
        visible={showRetryModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRetryModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowRetryModal(false)}
        >
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.modalButton} onPress={handleRetry}>
              <Text style={styles.modalButtonText}>🔄 Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modalButton, styles.modalButtonCancel]} 
              onPress={() => setShowRetryModal(false)}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: pinterestSpacing.xs,
    paddingHorizontal: pinterestSpacing.lg,
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  assistantContainer: {
    alignItems: 'flex-start',
  },
  bubbleRow: {
    flexDirection: 'row',
  },
  bubble: {
    maxWidth: '80%',
    padding: pinterestSpacing.lg,
    borderRadius: pinterestRounded.md,
  },
  userBubble: {
    backgroundColor: pinterestColors.primary,
    borderBottomRightRadius: pinterestRounded.sm,
  },
  assistantBubble: {
    backgroundColor: pinterestColors.fill,
    borderBottomLeftRadius: pinterestRounded.sm,
  },
  pendingBubble: {
    backgroundColor: pinterestColors.fill,
  },
  errorBubble: {
    backgroundColor: pinterestColors.fill,
  },
  voiceBubble: {
    backgroundColor: pinterestColors.fill,
  },
  userText: {
    color: pinterestColors['on-primary'],
    fontSize: 16,
    lineHeight: 22,
  },
  pendingContainer: {
    alignItems: 'flex-start',
  },
  pendingText: {
    color: pinterestColors.mute,
    fontSize: 14,
    fontStyle: 'italic',
  },
  errorContainer: {
    alignItems: 'flex-start',
  },
  errorText: {
    color: pinterestColors.destructive,
    fontSize: 14,
  },
  voicePlayerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 160,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: pinterestColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    color: pinterestColors['on-primary'],
    fontSize: 16,
  },
  voicePlayerRight: {
    marginLeft: pinterestSpacing.md,
  },
  voiceStatus: {
    fontSize: 14,
    color: pinterestColors.mute,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: pinterestColors.surface,
    borderRadius: pinterestRounded.lg,
    padding: pinterestSpacing.sm,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 5,
  },
  modalButton: {
    paddingVertical: pinterestSpacing.md,
    paddingHorizontal: pinterestSpacing.xl,
    borderRadius: pinterestRounded.md,
    alignItems: 'center',
  },
  modalButtonCancel: {
    marginTop: pinterestSpacing.sm,
    backgroundColor: pinterestColors.fill,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: pinterestColors.ink,
  },
});
