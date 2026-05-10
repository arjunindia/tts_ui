import { Voice } from '../types';

export const VOICES: Voice[] = [
  // Male voices (1-5)
  { id: 'M1', name: 'Marcus', gender: 'male' },
  { id: 'M2', name: 'James', gender: 'male' },
  { id: 'M3', name: 'David', gender: 'male' },
  { id: 'M4', name: 'Michael', gender: 'male' },
  { id: 'M5', name: 'Robert', gender: 'male' },
  // Female voices (6-10)
  { id: 'F1', name: 'Emma', gender: 'female' },
  { id: 'F2', name: 'Sophia', gender: 'female' },
  { id: 'F3', name: 'Olivia', gender: 'female' },
  { id: 'F4', name: 'Ava', gender: 'female' },
  { id: 'F5', name: 'Isabella', gender: 'female' },
];

export const getMaleVoices = () => VOICES.filter(v => v.gender === 'male');
export const getFemaleVoices = () => VOICES.filter(v => v.gender === 'female');
