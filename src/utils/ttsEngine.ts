/**
 * Supertonic-3 TTS Engine for React Native (Expo)
 *
 * Based on the official Node.js reference implementation:
 * https://github.com/supertone-inc/supertonic/tree/main/nodejs
 *
 * Model: Supertone/supertonic-3 on HuggingFace (~398 MB ONNX + ~3 MB voice styles)
 * Downloads from HuggingFace at runtime and caches locally.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { InferenceSession, Tensor } from 'onnxruntime-react-native';
import { Audio } from 'expo-av';

// ─── Constants ───────────────────────────────────────────────────────────────
const HF_REPO = 'Supertone/supertonic-3';
const HF_BASE = `https://huggingface.co/${HF_REPO}/resolve/main`;
const HF_ONNX = `${HF_BASE}/onnx`;
const HF_VOICES = `${HF_BASE}/voice_styles`;

const ONNX_FILES = [
  'duration_predictor.onnx',
  'text_encoder.onnx',
  'vector_estimator.onnx',
  'vocoder.onnx',
] as const;

const CFG_FILES = ['tts.json', 'unicode_indexer.json'] as const;

const VOICE_IDS = ['M1','M2','M3','M4','M5','F1','F2','F3','F4','F5'] as const;

const AVAILABLE_LANGS = [
  'en','ko','ja','ar','bg','cs','da','de','el','es','et','fi','fr','hi',
  'hr','hu','id','it','lt','lv','nl','pl','pt','ro','ru','sk','sl','sv','tr','uk','vi',
] as const;

type LangCode = typeof AVAILABLE_LANGS[number];
type VoiceId = typeof VOICE_IDS[number];

// ─── File helpers ─────────────────────────────────────────────────────────────

/** Download a file to cache dir if not already present, returns local URI */
async function getOrDownload(filename: string, url: string): Promise<string | null> {
  const cacheDir = FileSystem.cacheDirectory!;
  const path = cacheDir + filename;
  const info = await FileSystem.getInfoAsync(path);
  if (info.exists) return path;
  try {
    const dl = FileSystem.createDownloadResumable(url, path, {}, undefined);
    const result = await dl.downloadAsync();
    return result?.uri ? path : null;
  } catch (e) {
    console.warn(`[ttsEngine] Download failed: ${filename}`, e);
    return null;
  }
}

/** Read text file from cache */
async function readCacheText(filename: string): Promise<string | null> {
  try {
    const cacheDir = FileSystem.cacheDirectory!;
    return await FileSystem.readAsStringAsync(cacheDir + filename, { encoding: FileSystem.EncodingType.UTF8 });
  } catch { return null; }
}

/** Convert Float32 audio to WAV file, returns local URI */
async function float32ToWavUri(samples: Float32Array, sampleRate: number): Promise<string> {
  // Clamp to [-1, 1] first, then scale — matches reference implementation
  const int16 = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    int16[i] = Math.floor(clamped * 32767);
  }

  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * 2;
  const blockAlign = numChannels * 2;
  const dataSize = samples.length * 2;
  const totalSize = 44 + dataSize;

  const buf = new Uint8Array(totalSize);
  const view = new DataView(buf.buffer);

  buf.set([0x52,0x49,0x46,0x46], 0);
  view.setUint32(4, 36 + dataSize, true);
  buf.set([0x57,0x41,0x56,0x45], 8);
  buf.set([0x66,0x6D,0x74,0x20], 12);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  buf.set([0x64,0x61,0x74,0x61], 36);
  view.setUint32(40, dataSize, true);

  // PCM samples
  const pcm = new Int16Array(buf.buffer, 44);
  pcm.set(int16);

  const outPath = (FileSystem.cacheDirectory ?? '') + `supertonic_${Date.now()}.wav`;
  const b64 = uint8ToBase64(buf);
  await FileSystem.writeAsStringAsync(outPath, b64, { encoding: 'base64' });
  return outPath;
}

/** Uint8Array → base64 string (no external deps) */
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ─── Unicode Processor (faithful port of helper.js) ──────────────────────────

class UnicodeProcessor {
  // FIX #4: indexer is a flat array, not a Record — indexed by codepoint
  private indexer: number[] = [];

  constructor(indexerJson: number[]) {
    this.indexer = indexerJson;
  }

  private preprocessText(text: string, lang: LangCode): string {
    text = text.normalize('NFKD');

    // Remove emojis (Unicode ranges)
    text = text.replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]+/gu,
      ''
    );

    // Symbol normalizations — also normalize NB hyphen, backtick, acute accent
    text = text.split('\u2011').join('-');   // non-breaking hyphen (U+2011)
    text = text.split('\u2013').join('-');   // en dash
    text = text.split('\u2014').join('-');   // em dash
    text = text.split('\u201C').join('"');   // left double quote
    text = text.split('\u201D').join('"');   // right double quote
    text = text.split('\u2018').join("'");  // left single quote
    text = text.split('\u2019').join("'");  // right single quote
    text = text.split('\u0060').join("'");  // backtick
    text = text.split('\u00B4').join("'");  // acute accent
    text = text.split('[').join(' ');
    text = text.split(']').join(' ');
    text = text.split('|').join(' ');
    text = text.split('/').join(' ');
    text = text.split('#').join(' ');
    text = text.split('\u2192').join(' ');
    text = text.split('\u2190').join(' ');
    text = text.split('_').join(' ');

    // Remove special symbols
    text = text.replace(/[♥☆♡©\\]/g, '');

    // Expression replacements
    text = text.split('@').join(' at ');
    text = text.split('e.g.,').join('for example, ');
    text = text.split('i.e.,').join('that is, ');

    // Fix spacing around punctuation
    text = text.replace(/ ,/g, ',').replace(/ \./g, '.').replace(/ !/g, '!')
      .replace(/ \?/g, '?').replace(/ ;/g, ';').replace(/ :/g, ':').replace(/ '/g, "'");

    // Remove duplicate quotes
    while (text.includes('""')) text = text.split('""').join('"');
    while (text.includes("''")) text = text.split("''").join("'");

    // Collapse whitespace
    text = text.replace(/\s+/g, ' ').trim();

    // Auto-append period
    if (!/[.!?;:,'")\]]$/.test(text)) text += '.';

    // Validate language
    if (!AVAILABLE_LANGS.includes(lang as never)) {
      throw new Error(`Unsupported language: ${lang}`);
    }

    return `<${lang}>${text}</${lang}>`;
  }

  private textToUnicodeValues(text: string): number[] {
    return Array.from(text).map(c => c.charCodeAt(0));
  }

  call(texts: string[], langs: LangCode[]): { textIds: number[][]; textMask: number[][][] } {
    const processed = texts.map((t, i) => this.preprocessText(t, langs[i]));
    const lengths = processed.map(t => t.length);
    const maxLen = Math.max(...lengths);

    const textIds: number[][] = processed.map(text => {
      const row = new Array(maxLen).fill(0);
      const vals = this.textToUnicodeValues(text);
      for (let j = 0; j < vals.length; j++) {
        // FIX #4: use -1 for OOV characters (flat array indexing)
        row[j] = (vals[j] < this.indexer.length) ? this.indexer[vals[j]] : -1;
      }
      return row;
    });

    const textMask: number[][][] = lengths.map(len => {
      const row: number[] = [];
      for (let i = 0; i < maxLen; i++) row.push(i < len ? 1.0 : 0.0);
      return [row];
    });

    return { textIds, textMask };
  }
}

// ─── TTS Config ─────────────────────────────────────────────────────────────

interface TtsConfig {
  ttl: { latent_dim: number; chunk_compress_factor: number };
  ae: { sample_rate: number; base_chunk_size: number; chunk_compress_factor: number; ldim: number };
  dp: { latent_dim: number; chunk_compress_factor: number };
}

// ─── Main Engine ─────────────────────────────────────────────────────────────

export class SupertonicTTS {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private dpSession: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private textEncSession: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private vecEstSession: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private vocSession: any = null;

  private textProcessor: UnicodeProcessor | null = null;
  private config: TtsConfig | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private voiceStyles: Partial<Record<VoiceId, any>> = {};

  private _isLoaded = false;
  private _isDownloading = false;
  private _downloadProgress = 0;

  isModelLoaded(): boolean { return this._isLoaded; }
  isLoaded(): boolean { return this._isLoaded; } // convenience alias
  isDownloading(): boolean { return this._isDownloading; }
  downloadProgress(): number { return this._downloadProgress; }

  checkOnnxAvailability(): boolean {
    return !!(this.dpSession && this.textEncSession && this.vecEstSession && this.vocSession);
  }

  // ── Download + load ───────────────────────────────────────────────────────
  // FIX: Reordered so config/indexer is loaded BEFORE voice styles,
  // and ONNX sessions are created AFTER Tensor is available.

  async downloadModel(_modelId: string = 'default', onProgress?: (p: number) => void): Promise<boolean> {
    this._isDownloading = true;
    this._downloadProgress = 0;
    try {
      const totalFiles = ONNX_FILES.length + CFG_FILES.length + VOICE_IDS.length;
      let done = 0;
      const tick = () => { done++; this._downloadProgress = done / totalFiles; onProgress?.(this._downloadProgress); };

      // 1. Download ONNX model files
      for (const f of ONNX_FILES) {
        const r = await getOrDownload(f, `${HF_ONNX}/${f}`);
        if (!r) throw new Error(`Failed to download ${f}`);
        tick();
      }

      // 2. Download config files
      for (const f of CFG_FILES) {
        const r = await getOrDownload(f, `${HF_ONNX}/${f}`);
        if (!r) throw new Error(`Failed to download ${f}`);
        tick();
      }

      // 3. Load config + indexer (must be done before voice styles)
      const cfgRaw = await readCacheText('tts.json');
      if (!cfgRaw) throw new Error('Failed to load tts.json');
      this.config = JSON.parse(cfgRaw);

      const idxRaw = await readCacheText('unicode_indexer.json');
      if (!idxRaw) throw new Error('Failed to load unicode_indexer.json');
      // FIX #4: indexer is a flat array, not Record<string, number>
      const idxData: number[] = JSON.parse(idxRaw);
      this.textProcessor = new UnicodeProcessor(idxData);

      // 4. Download and load voice style files — Tensor is now available (static import above)
      for (const id of VOICE_IDS) {
        const r = await getOrDownload(`${id}.json`, `${HF_VOICES}/${id}.json`);
        if (r) await this.loadVoiceStyle(id, r);
        tick();
      }

      // 5. Create ONNX sessions sequentially (FIX #2: prevents OOM on mobile)
      // FIX #3: strip file:// URI scheme before passing to ONNX runtime
      const rawCachePath = (FileSystem.cacheDirectory ?? '').replace(/^file:\/\//, '');
      const opts = { executionProviders: ['cpu'] as const };
      this.dpSession      = await InferenceSession.create(rawCachePath + 'duration_predictor.onnx', opts);
      this.textEncSession = await InferenceSession.create(rawCachePath + 'text_encoder.onnx', opts);
      this.vecEstSession  = await InferenceSession.create(rawCachePath + 'vector_estimator.onnx', opts);
      this.vocSession     = await InferenceSession.create(rawCachePath + 'vocoder.onnx', opts);

      this._isLoaded = true;
      onProgress?.(1);
      return true;
    } catch (e) {
      console.error('[ttsEngine] loadModel error:', e);
      return false;
    } finally {
      this._isDownloading = false;
    }
  }

  async loadModel(_modelId: string = 'default'): Promise<boolean> {
    return this.downloadModel(_modelId);
  }

  private async loadVoiceStyle(id: VoiceId, path: string): Promise<void> {
    try {
      const raw = await FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.UTF8 });
      const vs: { style_ttl: { data: number[][][]; dims: number[] }; style_dp: { data: number[][][]; dims: number[] } } = JSON.parse(raw);

      // Flatten 3D → 1D
      const ttlFlat: number[] = [];
      for (const layer of vs.style_ttl.data) {
        for (const row of layer) {
          for (const v of row) ttlFlat.push(v);
        }
      }

      const dpFlat: number[] = [];
      for (const layer of vs.style_dp.data) {
        for (const row of layer) {
          for (const v of row) dpFlat.push(v);
        }
      }

      // Tensor is statically imported at top of file — no more _Tensor dependency
      this.voiceStyles[id] = {
        ttl: new Tensor('float32', Float32Array.from(ttlFlat), vs.style_ttl.dims as [number, number, number]),
        dp:  new Tensor('float32', Float32Array.from(dpFlat),  vs.style_dp.dims  as [number, number, number]),
      };
    } catch (e) {
      console.warn(`[ttsEngine] Failed to load voice ${id}:`, e);
    }
  }

  // ── Core synthesis ───────────────────────────────────────────────────────

  private lengthToMask(lengths: number[], maxLen?: number): number[][][] {
    const m = maxLen ?? Math.max(...lengths);
    return lengths.map(len => {
      const row: number[] = new Array(m);
      for (let i = 0; i < m; i++) row[i] = i < len ? 1.0 : 0.0;
      return [row];
    });
  }

  private getLatentMask(wavLengths: number[], baseChunkSize: number, chunkCompress: number): number[][][] {
    const latentSize = baseChunkSize * chunkCompress;
    const latentLengths = wavLengths.map(len => Math.floor((len + latentSize - 1) / latentSize));
    // FIX #5: pass explicit maxLen so mask and tensor dimensions always align
    const maxLen = Math.max(...latentLengths);
    return this.lengthToMask(latentLengths, maxLen);
  }

  // FIX #1: Correct config fields — ttl, not ae — and pass explicit maxLen
  private sampleNoisyLatent(durations: number[]): { noisyLatent: number[][][]; latentMask: number[][][] } {
    const cfg = this.config!;
    const sr = cfg.ae.sample_rate;
    const bcs = cfg.ae.base_chunk_size;
    // FIX #1: was cfg.ae.chunk_compress_factor — correct is ttl.chunk_compress_factor
    const ccf = cfg.ttl.chunk_compress_factor;
    // FIX #1: was cfg.ae.ldim — correct is ttl.latent_dim
    const ldim = cfg.ttl.latent_dim;

    // Minor: floor wavLenMax for integer arithmetic
    const wavLenMax = Math.floor(Math.max(...durations) * sr);
    const wavLengths = durations.map(d => Math.floor(d * sr));
    const chunkSize = bcs * ccf;
    const latentLen = Math.floor((wavLenMax + chunkSize - 1) / chunkSize);
    const latentDimVal = ldim * ccf;

    const noisyLatent: number[][][] = [];
    for (let b = 0; b < durations.length; b++) {
      const batch: number[][] = [];
      for (let d = 0; d < latentDimVal; d++) {
        const row: number[] = [];
        for (let t = 0; t < latentLen; t++) {
          // Box-Muller transform
          const u1 = Math.max(1e-10, Math.random());
          const u2 = Math.random();
          row.push(Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2));
        }
        batch.push(row);
      }
      noisyLatent.push(batch);
    }

    // FIX #5: pass explicit latentLen as maxLen to keep mask aligned
    const latentMask = this.getLatentMask(wavLengths, bcs, ccf);

    // Apply mask
    for (let b = 0; b < noisyLatent.length; b++) {
      for (let d = 0; d < noisyLatent[b].length; d++) {
        for (let t = 0; t < noisyLatent[b][d].length; t++) {
          noisyLatent[b][d][t] *= latentMask[b][0][t];
        }
      }
    }

    return { noisyLatent, latentMask };
  }

  // Tensor is statically imported — use it directly
  private arrayToTensor(arr: number[][][], dims: number[]): Tensor {
    const flat: number[] = [];
    for (const b of arr) for (const d of b) for (const v of d) flat.push(v);
    return new Tensor('float32', Float32Array.from(flat), dims as [number, number, number]);
  }

  private intArrayToTensor(arr: number[][], dims: number[]): Tensor {
    const flat: bigint[] = [];
    for (const row of arr) for (const v of row) flat.push(BigInt(v));
    return new Tensor('int64', new BigInt64Array(flat), dims as [number, number]);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async _infer(
    textList: string[],
    langList: LangCode[],
    style: { ttl: any; dp: any },
    totalStep: number,
    speed: number,
  ): Promise<{ wav: Float32Array; duration: number[] }> {
    const bsz = textList.length;

    const { textIds, textMask } = this.textProcessor!.call(textList, langList);
    const textIdsShape: [number, number] = [bsz, textIds[0].length];
    const textMaskShape: [number, number, number] = [bsz, 1, textMask[0][0].length];
    const textMaskTensor = this.arrayToTensor(textMask, textMaskShape);

    // Duration predictor
    const dpResult = await this.dpSession!.run({
      text_ids: this.intArrayToTensor(textIds, textIdsShape),
      style_dp: style.dp,
      text_mask: textMaskTensor,
    });
    // ONNX output key may vary; try common names
    const durationKey = Object.keys(dpResult).find(k =>
      k.toLowerCase().includes('duration') || k.toLowerCase().includes('dur')
    ) ?? Object.keys(dpResult)[0];
    const durOnnx = (dpResult[durationKey] as any).data as Float32Array;
    const durArr = Array.from(durOnnx).map(v => v / speed);

    // Text encoder
    const encResult = await this.textEncSession!.run({
      text_ids: this.intArrayToTensor(textIds, textIdsShape),
      style_ttl: style.ttl,
      text_mask: textMaskTensor,
    });
    const textEmbTensor = encResult['text_emb'] as any;

    // Sample noisy latent
    let { noisyLatent, latentMask } = this.sampleNoisyLatent(durArr);
    const latentShape: [number, number, number] = [bsz, noisyLatent[0].length, noisyLatent[0][0].length];
    const latentMaskShape: [number, number, number] = [bsz, 1, latentMask[0][0].length];
    const latentMaskTensor = this.arrayToTensor(latentMask, latentMaskShape);
    const totalStepArr = new Array(bsz).fill(totalStep);

    // Denoising loop
    for (let step = 0; step < totalStep; step++) {
      const currentStepArr = new Array(bsz).fill(step);

      const veResult = await this.vecEstSession!.run({
        noisy_latent: this.arrayToTensor(noisyLatent, latentShape),
        text_emb: textEmbTensor,
        style_ttl: style.ttl,
        text_mask: textMaskTensor,
        latent_mask: latentMaskTensor,
        total_step: new Tensor('float32', Float32Array.from(totalStepArr), [bsz]),
        current_step: new Tensor('float32', Float32Array.from(currentStepArr.map(Number)), [bsz]),
      });

      const denoisedKey = Object.keys(veResult).find(k =>
        k.toLowerCase().includes('denoised') || k.toLowerCase().includes('latent')
      ) ?? Object.keys(veResult)[0];
      const denoisedRaw = (veResult[denoisedKey] as any).data as Float32Array;

      // In-place update
      let idx = 0;
      outer: for (const b of noisyLatent) {
        for (const d of b) {
          for (let t = 0; t < d.length; t++) {
            d[t] = denoisedRaw[idx++];
            if (idx >= denoisedRaw.length) break outer;
          }
        }
      }
    }

    // Vocoder
    const vocResult = await this.vocSession!.run({
      latent: this.arrayToTensor(noisyLatent, latentShape),
    });
    const wavKey = Object.keys(vocResult).find(k =>
      k.toLowerCase().includes('wav') || k.toLowerCase().includes('output')
    ) ?? Object.keys(vocResult)[0];
    const wavRaw = (vocResult[wavKey] as any).data as Float32Array;

    return { wav: wavRaw, duration: durArr };
  }

  /** Synthesize text → Audio.Sound (Expo AV) */
  async synthesize(
    text: string,
    voiceId: VoiceId,
    lang: LangCode = 'en',
    totalStep = 8,
    speed = 1.05,
  ): Promise<Audio.Sound | null> {
    if (!this._isLoaded || !this.checkOnnxAvailability()) {
      console.error('[ttsEngine] Model not loaded. Call downloadModel() first.');
      return null;
    }

    const style = this.voiceStyles[voiceId];
    if (!style) {
      console.error(`[ttsEngine] Voice ${voiceId} not loaded.`);
      return null;
    }

    const cfg = this.config!;
    const sr = cfg.ae.sample_rate;
    const maxLen = (lang === 'ko' || lang === 'ja') ? 120 : 300;

    const chunks = this.chunkText(text, maxLen);
    let wavCat: Float32Array | null = null;

    for (const chunk of chunks) {
      const { wav } = await this._infer([chunk], [lang], style, totalStep, speed);
      if (!wavCat) {
        wavCat = wav;
      } else {
        const silenceLen = Math.floor(0.3 * sr);
        const silence = new Float32Array(silenceLen);
        const combined: Float32Array = new Float32Array((wavCat as Float32Array).length + silenceLen + wav.length);
        combined.set(wavCat, 0);
        combined.set(silence, (wavCat as Float32Array).length);
        combined.set(wav, (wavCat as Float32Array).length + silenceLen);
        wavCat = combined;
      }
    }

    if (!wavCat) return null;

    const wavUri = await float32ToWavUri(wavCat, sr);
    const { sound } = await Audio.Sound.createAsync({ uri: wavUri });
    return sound;
  }

  /** Chunk text into sentences within maxLen chars */
  // FIX #6: correct lookbehind regex — separate lookbehinds, | is literal inside [...]
  private chunkText(text: string, maxLen = 300): string[] {
    const paragraphs = text.trim().split(/\n\s*\n/).filter(p => p.trim());
    const chunks: string[] = [];
    for (const para of paragraphs) {
      const sentences = para.split(
        /(?<!Mr\.)(?<!Mrs\.)(?<!Ms\.)(?<!Dr\.)(?<!Prof\.)(?<!Sr\.)(?<!Jr\.)(?<!etc\.)(?<!e\.g\.)(?<!i\.e\.)(?<!Inc\.)(?<!Ltd\.)(?<!Co\.)(?<!St\.)(?<=[.!?])\s+/
      ).filter(Boolean);
      let current = '';
      for (const sent of sentences) {
        if (current.length + sent.length + 1 <= maxLen) {
          current += (current ? ' ' : '') + sent;
        } else {
          if (current) chunks.push(current.trim());
          current = sent;
        }
      }
      if (current) chunks.push(current.trim());
    }
    return chunks.length ? chunks : [text.slice(0, maxLen)];
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

const ttsEngine = new SupertonicTTS();
export default ttsEngine;
export type { VoiceId, LangCode };
