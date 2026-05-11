import { Voice } from '../types';

export const VOICES: Voice[] = [
  // Male voices (1-5)
  { id: 'M1', name: 'Marcus', gender: 'male', avatar: '👨' },
  { id: 'M2', name: 'James', gender: 'male', avatar: '👨‍🦱' },
  { id: 'M3', name: 'David', gender: 'male', avatar: '🧔' },
  { id: 'M4', name: 'Michael', gender: 'male', avatar: '👨‍🦲' },
  { id: 'M5', name: 'Robert', gender: 'male', avatar: '👴' },
  // Female voices (6-10)
  { id: 'F1', name: 'Emma', gender: 'female', avatar: '👩' },
  { id: 'F2', name: 'Sophia', gender: 'female', avatar: '👩‍🦰' },
  { id: 'F3', name: 'Olivia', gender: 'female', avatar: '👩‍🦱' },
  { id: 'F4', name: 'Ava', gender: 'female', avatar: '👩‍🦳' },
  { id: 'F5', name: 'Isabella', gender: 'female', avatar: '👩‍🦰' },
];

export const getMaleVoices = () => VOICES.filter(v => v.gender === 'male');
export const getFemaleVoices = () => VOICES.filter(v => v.gender === 'female');
