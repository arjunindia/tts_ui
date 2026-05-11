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
  avatar?: string; // optional emoji or image URI
}
