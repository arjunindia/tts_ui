import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Message } from '../types';
import { pinterestColors, pinterestRounded, pinterestSpacing } from '../theme/pinterest';

interface ChatMessageProps {
  message: Message;
  onRetry: (message: Message) => void;
  onPlayAudio: (message: Message) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  onRetry,
  onPlayAudio,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const isUser = message.role === 'user';
  const isPlaying = message.status === 'playing';
  const isLoading = message.status === 'pending';
  const hasError = message.status === 'error';

  const handlePress = () => {
    if (!isUser && !isLoading && !hasError) {
      onPlayAudio(message);
    }
  };

  const handleLongPress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.96,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onRetry(message);
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderUserMessage = () => (
    <View style={[styles.messageBubble, styles.userBubble]}>
      <Text style={styles.messageText}>{message.text}</Text>
      <Text style={styles.timestamp}>{formatTime(message.timestamp)}</Text>
    </View>
  );

  const renderAssistantMessage = () => (
    <View style={[styles.messageBubble, styles.assistantBubble]}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Generating audio...</Text>
          <View style={styles.loadingDots}>
            <View style={[styles.dot, styles.dotActive]} />
            <View style={[styles.dot, styles.dotActive, styles.dotDelay1]} />
            <View style={[styles.dot, styles.dotActive, styles.dotDelay2]} />
          </View>
        </View>
      ) : hasError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>!</Text>
          <Text style={styles.errorText}>Failed to generate</Text>
          <TouchableOpacity style={styles.errorRetry} onPress={() => onRetry(message)}>
            <Text style={styles.errorRetryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.playButton}
          onPress={handlePress}
          onLongPress={handleLongPress}
          activeOpacity={0.8}
        >
          <View style={[styles.playIcon, isPlaying && styles.pauseIcon]}>
            {isPlaying ? (
              <View style={styles.pauseBars}>
                <View style={styles.pauseBar} />
                <View style={styles.pauseBar} />
              </View>
            ) : (
              <View style={styles.playTriangle} />
            )}
          </View>
          <View style={styles.waveformContainer}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
              <View
                key={i}
                style={[
                  styles.waveformBar,
                  isPlaying && styles.waveformBarActive,
                ]}
              />
            ))}
          </View>
          <Text style={styles.voiceLabel}>Voice</Text>
        </TouchableOpacity>
      )}
      <Text style={[styles.timestamp, styles.assistantTimestamp]}>
        {formatTime(message.timestamp)}
      </Text>
    </View>
  );

  return (
    <Animated.View
      style={[
        styles.container,
        isUser ? styles.userContainer : styles.assistantContainer,
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      {isUser ? renderUserMessage() : renderAssistantMessage()}
    </Animated.View>
  );
};

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
  messageBubble: {
    maxWidth: '82%',
    padding: pinterestSpacing.md,
    borderRadius: pinterestRounded.lg,
  },
  userBubble: {
    backgroundColor: pinterestColors.primary,
    borderBottomRightRadius: pinterestSpacing.xs,
  },
  assistantBubble: {
    backgroundColor: pinterestColors['surface-card'],
    borderBottomLeftRadius: pinterestSpacing.xs,
    minWidth: 220,
  },
  messageText: {
    fontSize: 16,
    color: pinterestColors['on-primary'],
    lineHeight: 22,
  },
  timestamp: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: pinterestSpacing.xxs,
    alignSelf: 'flex-end',
  },
  assistantTimestamp: {
    color: pinterestColors.ash,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: pinterestSpacing.lg,
  },
  loadingText: {
    fontSize: 14,
    color: pinterestColors.mute,
    marginBottom: pinterestSpacing.md,
  },
  loadingDots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: pinterestColors.stone,
  },
  dotActive: {
    backgroundColor: pinterestColors.primary,
  },
  dotDelay1: {
    opacity: 0.6,
  },
  dotDelay2: {
    opacity: 0.3,
  },
  errorContainer: {
    alignItems: 'center',
    padding: pinterestSpacing.md,
  },
  errorIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: pinterestColors.error,
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: pinterestSpacing.sm,
  },
  errorText: {
    fontSize: 14,
    color: pinterestColors.body,
    marginBottom: pinterestSpacing.md,
  },
  errorRetry: {
    backgroundColor: pinterestColors.primary,
    paddingHorizontal: pinterestSpacing.lg,
    paddingVertical: pinterestSpacing.sm,
    borderRadius: pinterestRounded.full,
  },
  errorRetryText: {
    color: pinterestColors['on-primary'],
    fontSize: 14,
    fontWeight: '700',
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: pinterestSpacing.sm,
    backgroundColor: pinterestColors.canvas,
    borderRadius: pinterestRounded.md,
    minWidth: 200,
  },
  playIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: pinterestColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: pinterestSpacing.md,
  },
  pauseIcon: {
    backgroundColor: pinterestColors.error,
  },
  playTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: '#fff',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginLeft: 4,
  },
  pauseBars: {
    flexDirection: 'row',
    gap: 4,
  },
  pauseBar: {
    width: 5,
    height: 16,
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  waveformContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    gap: 3,
  },
  waveformBar: {
    width: 3,
    backgroundColor: pinterestColors.stone,
    borderRadius: 2,
    height: 10,
  },
  waveformBarActive: {
    backgroundColor: pinterestColors.primary,
    height: 18,
  },
  voiceLabel: {
    fontSize: 12,
    color: pinterestColors.mute,
    marginLeft: pinterestSpacing.sm,
    fontWeight: '500',
  },
});