export interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  audioUri?: string;
  status: 'pending' | 'playing' | 'done' | 'error';
  timestamp: Date;
}

export interface Voice {
  id: string;
  name: string;
  gender: 'male' | 'female';
}

export interface ChatPreview {
  voice: Voice;
  lastMessage: string;
  lastTimestamp: Date;
  unread: number;
}
