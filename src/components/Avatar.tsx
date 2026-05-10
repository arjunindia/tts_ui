import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Voice } from '../types';

interface AvatarProps {
  voice: Voice;
  size?: number;
}

const getAvatarColor = (id: string, gender: 'male' | 'female'): string => {
  const colors = gender === 'male'
    ? ['#5856D6', '#007AFF', '#34C759', '#FF9500', '#e60023']
    : ['#AF52DE', '#FF2D55', '#5AC8FA', '#FFCC00', '#e60023'];
  
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

const getInitials = (name: string): string => {
  return name.charAt(0).toUpperCase();
};

export const Avatar: React.FC<AvatarProps> = ({ voice, size = 48 }) => {
  const backgroundColor = getAvatarColor(voice.id, voice.gender);
  const initials = getInitials(voice.name);
  const fontSize = size * 0.4;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
        },
      ]}
    >
      <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#fff',
    fontWeight: '600',
  },
});