import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  SafeAreaView,
  StatusBar,
  Modal,
  BackHandler,
} from 'react-native';
import { Avatar } from '../components/Avatar';
import { ChatMessage } from '../components/ChatMessage';
import { ChatInput } from '../components/ChatInput';
import { Message, Voice } from '../types';
import { pinterestColors, pinterestRounded, pinterestSpacing } from '../theme/pinterest';

interface ChatScreenProps {
  voice: Voice;
  messages: Message[];
  onSendMessage: (text: string) => void;
  onRetry: (message: Message) => void;
  onUpdateLastMessage: (text: string) => void;
  onBack: () => void;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({
  voice,
  messages,
  onSendMessage,
  onRetry,
  onUpdateLastMessage,
  onBack,
}) => {
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => backHandler.remove();
  }, [onBack]);

  const scrollToBottom = () => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const handleSendMessage = (text: string) => {
    onUpdateLastMessage(text);
    onSendMessage(text);
    scrollToBottom();
  };

  const handlePlayAudio = (message: Message) => {
    if (currentlyPlayingId === message.id) {
      setCurrentlyPlayingId(null);
    } else {
      setCurrentlyPlayingId(message.id);
      setTimeout(() => {
        setCurrentlyPlayingId(null);
      }, 3000);
    }
  };

  const handleRetry = (message: Message) => {
    setSelectedMessage(message);
    setMenuVisible(true);
  };

  const confirmRetry = () => {
    if (selectedMessage) {
      onRetry(selectedMessage);
    }
    setMenuVisible(false);
    setSelectedMessage(null);
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <ChatMessage
      message={{
        ...item,
        status: item.id === currentlyPlayingId ? 'playing' : item.status,
      }}
      onRetry={handleRetry}
      onPlayAudio={handlePlayAudio}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={pinterestColors.canvas} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Avatar voice={voice} size={40} />
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{voice.name}</Text>
          <Text style={styles.headerStatus}>
            {voice.gender === 'male' ? 'Male voice' : 'Female voice'}
          </Text>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.chatContainer}
        onContentSizeChange={scrollToBottom}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              Say something to {voice.name}!
            </Text>
          </View>
        }
      />

      {/* Input */}
      <ChatInput onSendMessage={handleSendMessage} />

      {/* Retry Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menuContainer}>
            <TouchableOpacity style={styles.menuItem} onPress={confirmRetry}>
              <Text style={styles.menuItemText}>🔄 Retry</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setMenuVisible(false)}
            >
              <Text style={styles.menuItemText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: pinterestColors.canvas,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: pinterestSpacing.md,
    paddingVertical: pinterestSpacing.sm,
    backgroundColor: pinterestColors.canvas,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: pinterestColors.hairline,
  },
  backButton: {
    padding: pinterestSpacing.sm,
    marginRight: pinterestSpacing.xs,
  },
  backIcon: {
    fontSize: 24,
    color: pinterestColors.ink,
    fontWeight: '300',
  },
  headerInfo: {
    marginLeft: pinterestSpacing.md,
    flex: 1,
  },
  headerName: {
    fontSize: 17,
    fontWeight: '600',
    color: pinterestColors.ink,
  },
  headerStatus: {
    fontSize: 13,
    color: pinterestColors.mute,
  },
  chatContainer: {
    flexGrow: 1,
    paddingVertical: pinterestSpacing.sm,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: pinterestColors.mute,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    backgroundColor: pinterestColors.canvas,
    borderRadius: pinterestRounded.lg,
    padding: pinterestSpacing.sm,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 5,
  },
  menuItem: {
    padding: pinterestSpacing.md,
    borderRadius: pinterestRounded.md,
  },
  menuItemText: {
    fontSize: 16,
    color: pinterestColors.ink,
    textAlign: 'center',
  },
  menuDivider: {
    height: 1,
    backgroundColor: pinterestColors.hairline,
    marginHorizontal: pinterestSpacing.sm,
  },
});