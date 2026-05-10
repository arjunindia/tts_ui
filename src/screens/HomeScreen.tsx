import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Avatar } from '../components/Avatar';
import { Voice } from '../types';
import { VOICES } from '../data/voices';
import { pinterestColors, pinterestRounded, pinterestSpacing } from '../theme/pinterest';

interface HomeScreenProps {
  onSelectChat: (voice: Voice) => void;
  lastMessages: Map<string, string>;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onSelectChat,
  lastMessages,
}) => {
  const maleVoices = VOICES.filter(v => v.gender === 'male');
  const femaleVoices = VOICES.filter(v => v.gender === 'female');

  const renderChatItem = ({ item }: { item: Voice }) => {
    const lastMsg = lastMessages.get(item.id) || 'Start a conversation...';
    const preview = lastMsg.length > 45 ? lastMsg.substring(0, 45) + '...' : lastMsg;

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => onSelectChat(item)}
        activeOpacity={0.7}
      >
        <Avatar voice={item} size={52} />
        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatName}>{item.name}</Text>
            <Text style={styles.chatTime}>Now</Text>
          </View>
          <Text style={styles.chatPreview} numberOfLines={1}>
            {preview}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = (title: string) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
    </View>
  );

  const renderContent = () => {
    const sections: { title: string; data: Voice[] }[] = [];

    if (maleVoices.length > 0) {
      sections.push({ title: 'Male', data: maleVoices });
    }
    if (femaleVoices.length > 0) {
      sections.push({ title: 'Female', data: femaleVoices });
    }

    return sections.map((section) => (
      <View key={section.title}>
        {renderSectionHeader(section.title)}
        <FlatList
          data={section.data}
          renderItem={renderChatItem}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
        />
      </View>
    ));
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={pinterestColors.canvas} />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <Text style={styles.headerSubtitle}>{VOICES.length} voices available</Text>
      </View>

      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <Text style={styles.searchPlaceholder}>Search voices...</Text>
      </View>

      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={renderContent}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: pinterestColors.canvas,
  },
  header: {
    paddingHorizontal: pinterestSpacing.lg,
    paddingTop: pinterestSpacing.lg,
    paddingBottom: pinterestSpacing.sm,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: pinterestColors.ink,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: pinterestColors.mute,
    marginTop: pinterestSpacing.xxs,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: pinterestColors['surface-card'],
    borderRadius: pinterestRounded.full,
    paddingHorizontal: pinterestSpacing.lg,
    paddingVertical: pinterestSpacing.md,
    marginHorizontal: pinterestSpacing.lg,
    marginBottom: pinterestSpacing.md,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: pinterestSpacing.sm,
  },
  searchPlaceholder: {
    fontSize: 16,
    color: pinterestColors.ash,
  },
  listContent: {
    paddingBottom: pinterestSpacing.section,
  },
  sectionHeader: {
    backgroundColor: pinterestColors['surface-soft'],
    paddingHorizontal: pinterestSpacing.lg,
    paddingVertical: pinterestSpacing.sm,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: pinterestColors.mute,
    letterSpacing: 0.8,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: pinterestSpacing.lg,
    paddingVertical: pinterestSpacing.md,
    backgroundColor: pinterestColors.canvas,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: pinterestColors.hairline,
  },
  chatInfo: {
    flex: 1,
    marginLeft: pinterestSpacing.md,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: pinterestSpacing.xxs,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: pinterestColors.ink,
  },
  chatTime: {
    fontSize: 12,
    color: pinterestColors.ash,
  },
  chatPreview: {
    fontSize: 14,
    color: pinterestColors.mute,
    lineHeight: 18,
  },
});