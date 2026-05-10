import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
  Image,
} from 'react-native';
import { Message } from '../types';
import { pinterestColors, pinterestSpacing, pinterestRounded } from '../theme/pinterest';
import { Avatar } from './Avatar';

interface ChatMessageProps {
  message: Message;
  onPlayAudio: (messageId: string, audioUri?: string) => void;
  onRetry: (message: Message) => void;
}

export function ChatMessage({ message, onPlayAudio, onRetry }: ChatMessageProps) {
  const [showRetryModal, setShowRetryModal] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);

  const isUser = message.role === 'user';
  const isPending = message.status === 'pending';
  const isError = message.status === 'error';
  const isDone = message.status === 'done';
  const isPlayingStatus = message.status === 'playing';

  const handlePress = () => {
    if (isLongPress.current) {
      isLongPress.current = false;
      return;
    }
    
    if (isUser || isPending || isError) return;
    
    setIsPlaying(!isPlaying);
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
        {!isUser && (
          <View style={styles.avatarWrapper}>
            <Avatar voice={{ id: message.id, name: 'Voice', gender: 'female' }} size={32} />
          </View>
        )}
        
        <TouchableOpacity
          style={[
            styles.bubble,
            isUser ? styles.userBubble : styles.assistantBubble,
            isDone && message.audioUri ? styles.voiceBubble : null,
          ]}
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.8}
          disabled={isUser}
        >
          {isUser ? (
            <Text style={styles.userText}>{message.text}</Text>
          ) : isPending ? (
            <View style={styles.pendingContainer}>
              <Text style={styles.pendingText}>Generating audio...</Text>
            </View>
          ) : isError ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>Failed to generate</Text>
            </View>
          ) : (
            <View style={styles.voicePlayerContainer}>
              <View style={styles.voicePlayerLeft}>
                <TouchableOpacity style={styles.playButton}>
                  <Text style={styles.playIcon}>{isPlayingStatus ? '⏸' : '▶'}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.voicePlayerCenter}>
                <View style={styles.waveformContainer}>
                  {[...Array(20)].map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.waveformBar,
                        { height: Math.random() * 16 + 8 }
                      ]}
                    />
                  ))}
                </View>
              </View>
              <View style={styles.voicePlayerRight}>
                <Text style={styles.voiceDuration}>
                  {isPlayingStatus ? 'Playing' : 'Tap to play'}
                </Text>
              </View>
            </View>
          )}
        </TouchableOpacity>
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
    flexDirection: 'row',
    marginVertical: pinterestSpacing.xs,
    paddingHorizontal: pinterestSpacing.lg,
  },
  userContainer: {
    justifyContent: 'flex-end',
  },
  assistantContainer: {
    justifyContent: 'flex-start',
  },
  avatarWrapper: {
    marginRight: pinterestSpacing.sm,
    alignSelf: 'flex-end',
  },
  bubble: {
    maxWidth: '80%',
    padding: pinterestSpacing.lg,
    borderRadius: pinterestRounded.md,
  },
  userBubble: {
    backgroundColor: pinterestColors.primary,
    borderBottomRightRadius: pinterestRounded.xs,
  },
  assistantBubble: {
    backgroundColor: pinterestColors.fill,
    borderBottomLeftRadius: pinterestRounded.xs,
  },
  voiceBubble: {
    backgroundColor: pinterestColors.fill,
  },
  userText: {
    color: pinterestColors.onPrimary,
    fontSize: 16,
    lineHeight: 22,
  },
  pendingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pendingText: {
    color: pinterestColors.mute,
    fontSize: 14,
    fontStyle: 'italic',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorIcon: {
    fontSize: 16,
    marginRight: pinterestSpacing.sm,
  },
  errorText: {
    color: pinterestColors.destructive,
    fontSize: 14,
  },
  voicePlayerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 200,
  },
  voicePlayerLeft: {
    marginRight: pinterestSpacing.md,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: pinterestColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    color: pinterestColors.onPrimary,
    fontSize: 16,
  },
  voicePlayerCenter: {
    flex: 1,
    height: 32,
    justifyContent: 'center',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 32,
  },
  waveformBar: {
    width: 3,
    backgroundColor: pinterestColors.mute,
    borderRadius: 2,
  },
  voicePlayerRight: {
    marginLeft: pinterestSpacing.md,
  },
  voiceDuration: {
    fontSize: 12,
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
    padding: pinterestSpacing.md,
    minWidth: 200,
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
