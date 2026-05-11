import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { Message, Voice } from '../types';
import { pinterestColors, pinterestSpacing, pinterestRounded, pinterestTypography } from '../theme/pinterest';
import ttsEngine, { VoiceId } from '../utils/ttsEngine';
import { Avatar } from '../components/Avatar';

interface ChatScreenProps {
  voice: Voice;
  onBack: () => void;
  onMessagesChange?: (messages: Message[]) => void;
}

export function ChatScreen({ voice, onBack, onMessagesChange }: ChatScreenProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Sync messages up to App so HomeScreen can show last-message previews
  useEffect(() => {
    onMessagesChange?.(messages);
  }, [messages, onMessagesChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  // Hardware back button — go back to home
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => handler.remove();
  }, [onBack]);

  const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const stopCurrentAudio = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setCurrentPlayingId(null);
  };

  const playAudio = async (messageId: string, audioUri: string) => {
    await stopCurrentAudio();

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true },
        (status: AVPlaybackStatus) => {
          if (status.isLoaded && status.didJustFinish) {
            setCurrentPlayingId(null);
          }
        }
      );
      soundRef.current = sound;
      setCurrentPlayingId(messageId);
    } catch (error) {
      console.error('Error playing audio:', error);
      Alert.alert('Error', 'Failed to play audio');
    }
  };

  const handleSend = useCallback(async () => {
    // TODO: remove debug log after testing
    console.log('[Chat] handleSend called', { inputText: JSON.stringify(inputText), inputTextLen: inputText.length, isGenerating });
    if (!inputText.trim() || isGenerating) return;

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      text: inputText.trim(),
      status: 'done',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsGenerating(true);

    // Add placeholder message for assistant
    const assistantMessageId = generateId();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      text: '',
      status: 'pending',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, assistantMessage]);

    try {
      // Generate TTS audio
      const sound = await ttsEngine.synthesize(userMessage.text, voice.id as VoiceId);

      if (sound) {
        // Get audio URI
        const status = await sound.getStatusAsync();
        if (status.isLoaded && status.uri) {
          // Update message with audio
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, text: userMessage.text, audioUri: status.uri, status: 'done' }
                : msg
            )
          );

          // Play the audio
          await playAudio(assistantMessageId, status.uri);
        }
      } else {
        throw new Error('Failed to generate audio');
      }
    } catch (error) {
      console.error('Error generating audio:', error);
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, text: '[Error generating audio]', status: 'error' }
            : msg
        )
      );
    } finally {
      setIsGenerating(false);
    }
  }, [inputText, isGenerating, voice.id]);

  const handleRetry = useCallback((messageId: string) => {
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1 || messageIndex === 0) return;

    const userMessage = messages[messageIndex - 1];
    if (!userMessage || userMessage.role !== 'user') return;

    // Remove the failed message
    setMessages(prev => prev.filter(m => m.id !== messageId));

    // Re-generate
    setIsGenerating(true);

    const assistantMessageId = generateId();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      text: '',
      status: 'pending',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, assistantMessage]);

    ttsEngine.synthesize(userMessage.text, voice.id as VoiceId)
      .then(async (sound) => {
        if (sound) {
          const status = await sound.getStatusAsync();
          if (status.isLoaded && status.uri) {
            setMessages(prev =>
              prev.map(msg =>
                msg.id === assistantMessageId
                  ? { ...msg, text: userMessage.text, audioUri: status.uri, status: 'done' }
                  : msg
              )
            );
            await playAudio(assistantMessageId, status.uri);
          }
        }
      })
      .catch((error) => {
        console.error('Error retrying:', error);
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMessageId
              ? { ...msg, text: '[Error generating audio]', status: 'error' }
              : msg
          )
        );
      })
      .finally(() => {
        setIsGenerating(false);
      });
  }, [messages, voice.id]);

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isUser = item.role === 'user';
    const showRetry = !isUser && (item.status === 'error' || item.status === 'done');
    const isPlaying = currentPlayingId === item.id;

    return (
      <TouchableOpacity
        style={[
          styles.messageContainer,
          isUser ? styles.userMessageContainer : styles.assistantMessageContainer,
        ]}
        onLongPress={() => showRetry && handleRetry(item.id)}
        delayLongPress={500}
        activeOpacity={0.7}
      >
        {/* Avatar (only for assistant) */}
        {!isUser && (
          <View style={styles.assistantAvatarWrapper}>
            <Avatar voice={voice} size={32} />
          </View>
        )}

        {/* Message body */}
        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
          {isUser ? (
            <Text style={styles.userBubbleText}>{item.text}</Text>
          ) : (
            <>
              {item.audioUri ? (
                // Voice message player
                <TouchableOpacity
                  style={styles.audioPlayer}
                  onPress={() => isPlaying ? stopCurrentAudio() : playAudio(item.id, item.audioUri!)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.playButton, isPlaying && styles.playButtonPlaying]}>
                    <Ionicons
                      name={isPlaying ? 'pause' : 'play'}
                      size={18}
                      color={pinterestColors['on-primary']}
                    />
                  </View>
                  <View style={styles.waveformContainer}>
                    {[1, 2, 3, 4, 5].map(i => (
                      <View
                        key={i}
                        style={[
                          styles.waveformBar,
                          i === 2 && styles.waveformBarMedium,
                          i === 4 && styles.waveformBarShort,
                          isPlaying && styles.waveformBarPlaying,
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={styles.audioLabel}>
                    {isPlaying ? 'Playing…' : 'Voice Message'}
                  </Text>
                </TouchableOpacity>
              ) : item.status === 'pending' ? (
                <View style={styles.loadingContainer}>
                  <Ionicons name="hourglass" size={14} color={pinterestColors.mute} />
                  <Text style={styles.loadingText}>Generating…</Text>
                </View>
              ) : (
                <Text style={styles.messageText}>{item.text}</Text>
              )}
              {item.status === 'error' && (
                <TouchableOpacity onPress={() => handleRetry(item.id)}>
                  <Text style={styles.errorLabel}>Tap to retry</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyChat = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyAvatarWrapper}>
        <Avatar voice={voice} size={80} />
      </View>
      <Text style={styles.emptyTitle}>{voice.name}</Text>
      <Text style={styles.emptySubtitle}>
        Tap the send button after typing to generate a voice message
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        {/* Back button */}
        <TouchableOpacity style={styles.backButton} onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={pinterestColors.ink} />
        </TouchableOpacity>

        {/* Voice info */}
        <View style={styles.headerVoiceInfo}>
          <Avatar voice={voice} size={36} />
          <View style={styles.headerTextWrapper}>
            <Text style={styles.headerTitle} numberOfLines={1}>{voice.name}</Text>
            <Text style={styles.headerSubtitle}>
              {voice.gender === 'male' ? 'Male voice' : 'Female voice'}
            </Text>
          </View>
        </View>

        {/* Placeholder for symmetry */}
        <View style={styles.headerPlaceholder} />
      </View>

      {/* Divider */}
      <View style={styles.headerDivider} />

      {/* Messages + Input — flex column so KAV can push input above keyboard */}
      <View style={styles.body}>
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.messagesList,
            messages.length === 0 && styles.messagesListEmpty,
          ]}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          ListEmptyComponent={renderEmptyChat}
        />

        {/* Input — lifts above keyboard */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={styles.inputRow}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                value={inputText}
                onChangeText={(t) => {
                  console.log('[DEBUG] onChangeText called with:', JSON.stringify(t));
                  setInputText(t);
                }}
                placeholder="Type a message…"
                placeholderTextColor={pinterestColors.ash}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!inputText.trim() || isGenerating) && styles.sendButtonDisabled,
                ]}
                onPress={handleSend}
                disabled={!inputText.trim() || isGenerating}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="send"
                  size={18}
                  color={pinterestColors['on-primary']}
                />
              </TouchableOpacity>
            </View>
            {/* DEBUG — remove after testing */}
            <Text style={styles.debugText}>
              text="{inputText}" | generating={String(isGenerating)} | disabled={String(!inputText.trim() || isGenerating)}
            </Text>
          </View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: pinterestColors.canvas,
  },
  body: {
    flex: 1,
  },
  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: pinterestSpacing.sm,
    paddingVertical: pinterestSpacing.sm,
    backgroundColor: pinterestColors.canvas,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerVoiceInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: pinterestSpacing.sm,
  },
  headerTextWrapper: {
    alignItems: 'flex-start',
  },
  headerTitle: {
    ...pinterestTypography.subhead,
    fontWeight: '700',
    color: pinterestColors.ink,
  },
  headerSubtitle: {
    ...pinterestTypography.caption,
    color: pinterestColors.mute,
  },
  headerPlaceholder: {
    width: 40,
  },
  headerDivider: {
    height: 1,
    backgroundColor: pinterestColors.hairline,
  },
  // ── Messages ────────────────────────────────────────────────────────────────
  messagesList: {
    paddingVertical: pinterestSpacing.md,
    flexGrow: 1,
  },
  messagesListEmpty: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageContainer: {
    marginBottom: pinterestSpacing.md,
    paddingHorizontal: pinterestSpacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  assistantMessageContainer: {
    justifyContent: 'flex-start',
  },
  assistantAvatarWrapper: {
    marginRight: pinterestSpacing.sm,
  },
  messageBubble: {
    padding: pinterestSpacing.md,
    borderRadius: pinterestRounded.md,
    maxWidth: '75%',
  },
  // Pinterest red bubble — text must be white for readability
  userBubble: {
    backgroundColor: pinterestColors.primary,
    borderBottomRightRadius: pinterestRounded.sm,
  },
  userBubbleText: {
    ...pinterestTypography.body,
    color: pinterestColors['on-primary'],
    lineHeight: 20,
  },
  assistantBubble: {
    backgroundColor: pinterestColors['surface-card'],
    borderBottomLeftRadius: pinterestRounded.sm,
  },
  messageText: {
    ...pinterestTypography.body,
    color: pinterestColors.ink,
    lineHeight: 20,
  },
  // ── Audio Player ────────────────────────────────────────────────────────────
  audioPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 180,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: pinterestColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: pinterestSpacing.sm,
  },
  playButtonPlaying: {
    backgroundColor: pinterestColors['primary-pressed'],
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
    marginRight: pinterestSpacing.sm,
  },
  waveformBar: {
    width: 3,
    height: 12,
    backgroundColor: pinterestColors.primary,
    borderRadius: 1.5,
    marginHorizontal: 1,
  },
  waveformBarMedium: {
    height: 18,
  },
  waveformBarShort: {
    height: 8,
  },
  waveformBarPlaying: {
    backgroundColor: pinterestColors.primary,
  },
  audioLabel: {
    ...pinterestTypography.caption,
    color: pinterestColors.mute,
  },
  // ── States ─────────────────────────────────────────────────────────────────
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pinterestSpacing.xs,
  },
  loadingText: {
    ...pinterestTypography.caption,
    color: pinterestColors.mute,
    fontStyle: 'italic',
  },
  errorLabel: {
    ...pinterestTypography.caption,
    color: pinterestColors.destructive,
    marginTop: pinterestSpacing.xs,
    fontWeight: '600',
  },
  // ── Empty state ────────────────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: pinterestSpacing.xxl,
  },
  emptyAvatarWrapper: {
    marginBottom: pinterestSpacing.lg,
  },
  emptyTitle: {
    ...pinterestTypography.headline,
    color: pinterestColors.ink,
    marginBottom: pinterestSpacing.sm,
  },
  emptySubtitle: {
    ...pinterestTypography.body,
    color: pinterestColors.mute,
    textAlign: 'center',
    lineHeight: 20,
  },
  // ── Input ─────────────────────────────────────────────────────────────────
  inputRow: {
    backgroundColor: pinterestColors.canvas,
    borderTopWidth: 1,
    borderTopColor: pinterestColors.hairline,
    paddingHorizontal: pinterestSpacing.lg,
    paddingVertical: pinterestSpacing.md,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: pinterestColors['surface-card'],
    borderRadius: pinterestRounded.full,
    paddingHorizontal: pinterestSpacing.md,
    paddingVertical: pinterestSpacing.sm,
  },
  textInput: {
    flex: 1,
    flexShrink: 1,
    flexBasis: 0,
    ...pinterestTypography.body,
    color: pinterestColors.ink,
    maxHeight: 100,
    paddingVertical: pinterestSpacing.xs,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: pinterestColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: pinterestSpacing.sm,
  },
  sendButtonDisabled: {
    backgroundColor: pinterestColors.stone,
  },
  debugText: {
    fontSize: 10,
    color: 'red',
    marginTop: 4,
  },
});
