import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { pinterestColors, pinterestRounded, pinterestSpacing } from '../theme/pinterest';

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  disabled = false,
}) => {
  const [text, setText] = useState('');

  const handleSend = () => {
    if (text.trim() && !disabled) {
      onSendMessage(text.trim());
      setText('');
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.inputRow}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Message"
              placeholderTextColor={pinterestColors.ash}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={1000}
              editable={!disabled}
            />
          </View>
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!text.trim() || disabled) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!text.trim() || disabled}
          >
            <View style={styles.sendIcon}>
              <View style={styles.arrow} />
            </View>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: pinterestColors.canvas,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: pinterestColors.hairline,
    paddingBottom: Platform.OS === 'ios' ? 0 : pinterestSpacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: pinterestSpacing.md,
    paddingVertical: pinterestSpacing.sm,
  },
  inputContainer: {
    flex: 1,
    backgroundColor: pinterestColors['surface-card'],
    borderRadius: pinterestRounded.full,
    paddingHorizontal: pinterestSpacing.lg,
    paddingVertical: pinterestSpacing.sm,
    marginRight: pinterestSpacing.sm,
    maxHeight: 100,
  },
  input: {
    fontSize: 16,
    color: pinterestColors.ink,
    maxHeight: 80,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: pinterestColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: pinterestColors.stone,
  },
  sendIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftColor: '#fff',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginLeft: 2,
  },
});
