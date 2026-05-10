import { Voice } from '../types';

export const VOICES: Voice[] = [
  // Male voices (1-5)
  { id: 'male_1', name: 'Marcus', gender: 'male' },
  { id: 'male_2', name: 'James', gender: 'male' },
  { id: 'male_3', name: 'David', gender: 'male' },
  { id: 'male_4', name: 'Michael', gender: 'male' },
  { id: 'male_5', name: 'Robert', gender: 'male' },
  // Female voices (6-10)
  { id: 'female_1', name: 'Emma', gender: 'female' },
  { id: 'female_2', name: 'Sophia', gender: 'female' },
  { id: 'female_3', name: 'Olivia', gender: 'female' },
  { id: 'female_4', name: 'Ava', gender: 'female' },
  { id: 'female_5', name: 'Isabella', gender: 'female' },
];

export const getMaleVoices = () => VOICES.filter(v => v.gender === 'male');
export const getFemaleVoices = () => VOICES.filter(v => v.gender === 'female');