import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Voice } from '../types';
import { VOICES } from '../data/voices';

interface VoiceSelectorProps {
  selectedVoiceId: string;
  onSelectVoice: (voice: Voice) => void;
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  selectedVoiceId,
  onSelectVoice,
}) => {
  const maleVoices = VOICES.filter(v => v.gender === 'male');
  const femaleVoices = VOICES.filter(v => v.gender === 'female');

  const renderVoiceButton = (voice: Voice) => {
    const isSelected = selectedVoiceId === voice.id;
    return (
      <TouchableOpacity
        key={voice.id}
        style={[
          styles.voiceButton,
          isSelected && styles.voiceButtonSelected,
        ]}
        onPress={() => onSelectVoice(voice)}
      >
        <Text style={styles.voiceEmoji}>{voice.avatar}</Text>
        <Text style={[styles.voiceName, isSelected && styles.voiceNameSelected]}>
          {voice.name}
        </Text>
        <Text style={styles.voiceGender}>{voice.gender}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Male Voices</Text>
      <View style={styles.voiceRow}>
        {maleVoices.map(renderVoiceButton)}
      </View>

      <Text style={styles.sectionTitle}>Female Voices</Text>
      <View style={styles.voiceRow}>
        {femaleVoices.map(renderVoiceButton)}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    marginTop: 12,
  },
  voiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  voiceButton: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    width: 64,
  },
  voiceButtonSelected: {
    backgroundColor: '#007AFF',
  },
  voiceEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  voiceName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
  },
  voiceNameSelected: {
    color: '#fff',
  },
  voiceGender: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
});