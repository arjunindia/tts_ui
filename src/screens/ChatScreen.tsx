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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { Message, Voice } from '../types';
import { pinterestColors, pinterestSpacing, pinterestTypography } from '../theme/pinterest';
import ttsEngine, { VoiceId } from '../utils/ttsEngine';

interface ChatScreenProps {
  voice: Voice;
  onBack: () => void;
}

export function ChatScreen({ voice, onBack }: ChatScreenProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

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
        <View style={styles.messageContent}>
          {/* Avatar */}
          <View style={[styles.avatar, isUser ? styles.userAvatar : styles.assistantAvatar]}>
            <Text style={styles.avatarText}>
              {isUser ? '👤' : '🔊'}
            </Text>
          </View>

          {/* Message body */}
          <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
            {isUser ? (
              <Text style={styles.messageText}>{item.text}</Text>
            ) : (
              <>
                {item.audioUri ? (
                  <TouchableOpacity
                    style={styles.audioPlayer}
                    onPress={() => isPlaying ? stopCurrentAudio() : playAudio(item.id, item.audioUri!)}
                  >
                    <View style={styles.playButton}>
                      <Text style={styles.playButtonText}>
                        {isPlaying ? '⏸' : '▶️'}
                      </Text>
                    </View>
                    <View style={styles.waveformContainer}>
                      <View style={[styles.waveformBar, isPlaying && styles.waveformPlaying]} />
                      <View style={[styles.waveformBar, styles.waveformBarMedium, isPlaying && styles.waveformPlaying]} />
                      <View style={[styles.waveformBar, isPlaying && styles.waveformPlaying]} />
                      <View style={[styles.waveformBar, styles.waveformBarShort, isPlaying && styles.waveformPlaying]} />
                      <View style={[styles.waveformBar, isPlaying && styles.waveformPlaying]} />
                    </View>
                    <Text style={styles.audioLabel}>Voice Message</Text>
                  </TouchableOpacity>
                ) : item.status === 'pending' ? (
                  <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Generating...</Text>
                  </View>
                ) : (
                  <Text style={styles.messageText}>{item.text}</Text>
                )}
                {item.status === 'error' && (
                  <Text style={styles.errorLabel}>Tap to retry</Text>
                )}
              </>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Voice Chat</Text>
          <Text style={styles.headerSubtitle}>{voice.name} • {voice.gender}</Text>
        </View>
        <View style={styles.headerPlaceholder} />
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputContainer}
      >
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            placeholderTextColor={pinterestColors.mute}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || isGenerating) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || isGenerating}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: pinterestColors.canvas,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: pinterestSpacing.lg,
    paddingVertical: pinterestSpacing.md,
    backgroundColor: pinterestColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: pinterestColors.hairline,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: pinterestColors.ink,
  },
  headerInfo: {
    alignItems: 'center',
  },
  headerTitle: {
    ...pinterestTypography.subhead,
    color: pinterestColors.ink,
  },
  headerSubtitle: {
    ...pinterestTypography.caption,
    color: pinterestColors.mute,
  },
  headerPlaceholder: {
    width: 40,
  },
  messagesList: {
    padding: pinterestSpacing.md,
    flexGrow: 1,
  },
  messageContainer: {
    marginBottom: pinterestSpacing.md,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
    flexDirection: 'row-reverse',
  },
  assistantMessageContainer: {
    alignItems: 'flex-start',
  },
  messageContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    maxWidth: '80%',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: pinterestSpacing.sm,
  },
  userAvatar: {
    backgroundColor: pinterestColors.primary,
  },
  assistantAvatar: {
    backgroundColor: pinterestColors.canvas,
  },
  avatarText: {
    fontSize: 18,
  },
  messageBubble: {
    padding: pinterestSpacing.md,
    borderRadius: pinterestSpacing.lg,
    maxWidth: '100%',
  },
  userBubble: {
    backgroundColor: pinterestColors.primary,
    borderBottomRightRadius: 4,
    color: pinterestColors['on-primary'],
  },
  assistantBubble: {
    backgroundColor: pinterestColors.surface,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    ...pinterestTypography.body,
    color: pinterestColors.ink,
  },
  audioPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: pinterestSpacing.xs,
    minWidth: 200,
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
  playButtonText: {
    fontSize: 16,
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
  waveformPlaying: {
    backgroundColor: pinterestColors.primary,
  },
  audioLabel: {
    ...pinterestTypography.caption,
    color: pinterestColors.mute,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingText: {
    ...pinterestTypography.caption,
    color: pinterestColors.mute,
  },
  errorLabel: {
    ...pinterestTypography.caption,
    color: '#C62828',
    marginTop: pinterestSpacing.xs,
  },
  inputContainer: {
    padding: pinterestSpacing.md,
    backgroundColor: pinterestColors.surface,
    borderTopWidth: 1,
    borderTopColor: pinterestColors.hairline,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: pinterestColors.canvas,
    borderRadius: pinterestSpacing.lg,
    paddingHorizontal: pinterestSpacing.md,
    paddingVertical: pinterestSpacing.sm,
  },
  textInput: {
    flex: 1,
    ...pinterestTypography.body,
    color: pinterestColors.ink,
    maxHeight: 100,
    paddingVertical: pinterestSpacing.xs,
  },
  sendButton: {
    backgroundColor: pinterestColors.primary,
    paddingVertical: pinterestSpacing.sm,
    paddingHorizontal: pinterestSpacing.md,
    borderRadius: pinterestSpacing.md,
    marginLeft: pinterestSpacing.sm,
  },
  sendButtonDisabled: {
    backgroundColor: pinterestColors.mute,
  },
  sendButtonText: {
    ...pinterestTypography.button,
    color: pinterestColors['on-primary'],
  },
});
