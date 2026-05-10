import * as FileSystem from 'expo-file-system';
import { InferenceSession, Tensor } from 'onnxruntime-react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { Platform } from 'react-native';

// Base URL for Supertonic model files
const MODEL_BASE_URL = 'https://huggingface.co/Supertone/supertonic-3/resolve/main';
const VOICE_BASE_URL = 'https://huggingface.co/Supertone/supertonic-3/resolve/main/voice_styles';

// Constants
const SAMPLE_RATE = 24000;

// Available languages
const AVAILABLE_LANGS = [
  'en', 'ko', 'ja', 'ar', 'bg', 'cs', 'da', 'de', 'el', 'es', 
  'fa', 'fr', 'he', 'hi', 'hr', 'hu', 'id', 'it', 'lt', 'ms', 
  'nl', 'pl', 'pt', 'ro', 'ru', 'sk', 'sq', 'sv', 'th', 'tr', 'uk', 'vi', 'zh'
];

// ASCII to IPA mapping for text normalization
const LATIN_TO_IPA: Record<string, string> = {
  'a': 'ə', 'e': 'ɛ', 'i': 'ɪ', 'o': 'o', 'u': 'ʌ',
  'th': 'θ', 'sh': 'ʃ', 'ch': 'tʃ', 'ng': 'ŋ', 'j': 'dʒ',
};

// Common words for basic English phonemization
const COMMON_WORDS: Record<string, string> = {
  'hello': 'həˈloʊ', 'world': 'wˈɝld', 'the': 'ðə', 'is': 'ɪz',
  'a': 'ə', 'test': 'tˈɛst', 'this': 'ðˈɪs', 'app': 'ˈæp',
  'voice': 'vˈɔɪs', 'speech': 'spˈiːtʃ', 'audio': 'ˈɔːdioʊ',
};

class SupertonicTTS {
  private session: InferenceSession | null = null;
  private isModelLoaded = false;
  private currentModelId: string | null = null;

  /**
   * Check if ONNX runtime is available
   */
  checkOnnxAvailability(): boolean {
    try {
      if (typeof InferenceSession === 'undefined' || typeof InferenceSession.create !== 'function') {
        console.error('ONNX Runtime is not properly initialized');
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error checking ONNX availability:', error);
      return false;
    }
  }

  /**
   * Load ONNX model from local cache
   */
  async loadModel(modelId: string = 'model.onnx'): Promise<boolean> {
    try {
      if (!this.checkOnnxAvailability()) {
        console.error('ONNX Runtime is not available on this platform');
        return false;
      }
      
      const modelPath = FileSystem.cacheDirectory + modelId;
      const fileInfo = await FileSystem.getInfoAsync(modelPath);
      
      if (!fileInfo.exists) {
        console.error('Model file not found at', modelPath);
        return false;
      }

      console.log('Loading model from:', modelPath);
      
      const options = {
        executionProviders: ['cpu'],
        graphOptimizationLevel: 'all' as const,
      };
      
      this.session = await InferenceSession.create(modelPath, options);
      
      if (!this.session) {
        console.error('Failed to create inference session');
        return false;
      }
      
      this.isModelLoaded = true;
      this.currentModelId = modelId;
      console.log('Model loaded successfully:', modelId);
      return true;
    } catch (error) {
      console.error('Error loading model:', error);
      return false;
    }
  }

  /**
   * Download a model file
   */
  async downloadModel(modelId: string, onProgress?: (progress: number) => void): Promise<boolean> {
    try {
      const modelPath = FileSystem.cacheDirectory + modelId;
      const fileInfo = await FileSystem.getInfoAsync(modelPath);
      
      if (fileInfo.exists) {
        console.log(`Model ${modelId} already cached`);
        return true;
      }

      const url = `${MODEL_BASE_URL}/onnx/${modelId}`;
      console.log(`Downloading model from ${url}`);

      const downloadResumable = FileSystem.createDownloadResumable(
        url,
        modelPath,
        {},
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          onProgress?.(progress);
        }
      );

      const result = await downloadResumable.downloadAsync();
      return !!result?.uri;
    } catch (error) {
      console.error('Error downloading model:', error);
      return false;
    }
  }

  /**
   * Download a voice style file
   */
  async downloadVoiceStyle(voiceId: string): Promise<boolean> {
    try {
      const voicePath = FileSystem.documentDirectory + `voices/${voiceId}.json`;
      const fileInfo = await FileSystem.getInfoAsync(voicePath);
      
      if (fileInfo.exists) {
        return true;
      }

      // Create voices directory
      const voicesDir = FileSystem.documentDirectory + 'voices/';
      const dirInfo = await FileSystem.getInfoAsync(voicesDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(voicesDir, { intermediates: true });
      }

      const url = `${VOICE_BASE_URL}/${voiceId}.json`;
      console.log(`Downloading voice style from ${url}`);

      const result = await FileSystem.downloadAsync(url, voicePath);
      return result.status === 200;
    } catch (error) {
      console.error('Error downloading voice style:', error);
      return false;
    }
  }

  /**
   * Load voice style from local file
   */
  async loadVoiceStyle(voiceId: string): Promise<number[] | null> {
    try {
      const voicePath = FileSystem.documentDirectory + `voices/${voiceId}.json`;
      const fileInfo = await FileSystem.getInfoAsync(voicePath);
      
      if (!fileInfo.exists) {
        console.log(`Voice style ${voiceId} not found locally, downloading...`);
        const downloaded = await this.downloadVoiceStyle(voiceId);
        if (!downloaded) return null;
      }

      const content = await FileSystem.readAsStringAsync(voicePath);
      const data = JSON.parse(content);
      return data.embedding || data.style || null;
    } catch (error) {
      console.error('Error loading voice style:', error);
      return null;
    }
  }

  /**
   * Normalize text for synthesis
   */
  normalizeText(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/…/g, '...');
  }

  /**
   * Simple phonemization (basic English approximation)
   */
  phonemize(text: string): string {
    const normalized = this.normalizeText(text);
    const words = normalized.split(/\s+/);
    
    return words.map(word => {
      const lower = word.toLowerCase().replace(/[.,!?;:'"]/g, '');
      if (COMMON_WORDS[lower]) {
        return COMMON_WORDS[lower];
      }
      
      // Simple character-by-character mapping
      let phonemes = '';
      for (const char of word) {
        const lowerChar = char.toLowerCase();
        if (LATIN_TO_IPA[lowerChar]) {
          phonemes += LATIN_TO_IPA[lowerChar];
        } else if (/[a-z]/.test(lowerChar)) {
          phonemes += char;
        } else if (/[.,!?;:'"]/.test(char)) {
          phonemes += char;
        }
      }
      return phonemes;
    }).join(' ');
  }

  /**
   * Tokenize text for model input
   */
  tokenize(text: string): number[] {
    const phonemes = this.phonemize(text);
    const tokens: number[] = [0]; // Start token
    
    // Simple character-based tokenization
    for (const char of phonemes) {
      tokens.push(char.charCodeAt(0));
    }
    
    tokens.push(0); // End token
    return tokens;
  }

  /**
   * Generate audio from text
   */
  async synthesize(text: string, voiceId: string): Promise<Audio.Sound | null> {
    if (!this.isModelLoaded || !this.session) {
      console.error('Model not loaded. Call loadModel() first.');
      return null;
    }

    try {
      // Load voice style
      const styleData = await this.loadVoiceStyle(voiceId);
      if (!styleData) {
        console.error('Failed to load voice style');
        return null;
      }

      // Tokenize input
      const tokens = this.tokenize(text);
      const numTokens = Math.min(Math.max(tokens.length - 2, 0), 509);

      // Prepare input tensors
      const inputs: Record<string, Tensor> = {};
      inputs['input_ids'] = new Tensor('int64', new Int32Array(tokens), [1, tokens.length]);
      inputs['style'] = new Tensor('float32', new Float32Array(styleData), [1, styleData.length]);
      inputs['speed'] = new Tensor('float32', new Float32Array([1.0]), [1]);

      console.log('Running inference...');
      
      // Run inference
      const outputs = await this.session.run(inputs);
      
      if (!outputs || !outputs['waveform']) {
        console.error('Invalid output from model inference');
        return null;
      }

      // Convert output to audio file
      const waveform = outputs['waveform'].data;
      const audioUri = await this.floatArrayToAudioFile(waveform);

      // Create and return sound
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: false }
      );

      return sound;
    } catch (error) {
      console.error('Error synthesizing audio:', error);
      return null;
    }
  }

  /**
   * Convert Float32Array to WAV file
   */
  private async floatArrayToAudioFile(floatArray: Float32Array | Float64Array): Promise<string> {
    const numSamples = floatArray.length;
    const int16Array = new Int16Array(numSamples);
    
    // Convert to 16-bit PCM
    for (let i = 0; i < numSamples; i++) {
      const sample = floatArray[i];
      int16Array[i] = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    }

    // Create WAV buffer
    const wavBuffer = this.createWavBuffer(int16Array, SAMPLE_RATE);
    
    // Convert to base64
    const base64Data = this.arrayBufferToBase64(wavBuffer);
    
    // Save to temp file
    const tempPath = `${FileSystem.cacheDirectory}temp_audio_${Date.now()}.wav`;
    await FileSystem.writeAsStringAsync(tempPath, base64Data, { encoding: FileSystem.EncodingType.Base64 });
    
    return tempPath;
  }

  private createWavBuffer(int16Array: Int16Array, sampleRate: number): ArrayBuffer {
    const headerLength = 44;
    const dataLength = int16Array.length * 2;
    const buffer = new ArrayBuffer(headerLength + dataLength);
    const view = new DataView(buffer);
    
    // RIFF header
    view.setUint8(0, 0x52); view.setUint8(1, 0x49); // 'R', 'I'
    view.setUint8(2, 0x46); view.setUint8(3, 0x46); // 'F', 'F'
    view.setUint32(4, 36 + dataLength, true);
    view.setUint8(8, 0x57); view.setUint8(9, 0x41); // 'W', 'A'
    view.setUint8(10, 0x56); view.setUint8(11, 0x45); // 'V', 'E'
    
    // fmt chunk
    view.setUint8(12, 0x66); view.setUint8(13, 0x6D); // 'f', 'm'
    view.setUint8(14, 0x74); view.setUint8(15, 0x20); // 't', ' '
    view.setUint32(16, 16, true); // chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // byte rate
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    
    // data chunk
    view.setUint8(36, 0x64); view.setUint8(37, 0x61); // 'd', 'a'
    view.setUint8(38, 0x74); view.setUint8(39, 0x61); // 't', 'a'
    view.setUint32(40, dataLength, true);
    
    // Write audio data
    for (let i = 0; i < int16Array.length; i++) {
      view.setInt16(headerLength + i * 2, int16Array[i], true);
    }
    
    return buffer;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Check if model is loaded
   */
  isLoaded(): boolean {
    return this.isModelLoaded;
  }

  /**
   * Get current model ID
   */
  getCurrentModelId(): string | null {
    return this.currentModelId;
  }
}

// Export singleton instance
const ttsEngine = new SupertonicTTS();
export default ttsEngine;
export { SupertonicTTS };
