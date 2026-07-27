/**
 * PCM Generator for streaming test audio
 * Produces raw 16-bit signed LE mono PCM frames.
 */

export function generateSilence(durationMs: number, sampleRate: number): Buffer {
  const numSamples = Math.floor(sampleRate * (durationMs / 1000));
  const buffer = Buffer.alloc(numSamples * 2); // 2 bytes per sample (16-bit)
  buffer.fill(0); // silence = zero amplitude
  return buffer;
}

export function generateSineWave(
  durationMs: number,
  sampleRate: number,
  frequency: number = 440,
  amplitude: number = 0.3
): Buffer {
  const numSamples = Math.floor(sampleRate * (durationMs / 1000));
  const buffer = Buffer.alloc(numSamples * 2);
  const maxAmplitude = amplitude * 32767;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * frequency * t) * maxAmplitude;
    buffer.writeInt16LE(Math.round(sample), i * 2);
  }

  return buffer;
}

export function splitIntoChunks(
  buffer: Buffer,
  chunkSizeMs: number,
  sampleRate: number
): Buffer[] {
  const chunkBytes = Math.floor(sampleRate * (chunkSizeMs / 1000)) * 2;
  if (chunkBytes <= 0) return [buffer];

  const chunks: Buffer[] = [];
  for (let offset = 0; offset < buffer.length; offset += chunkBytes) {
    const end = Math.min(offset + chunkBytes, buffer.length);
    chunks.push(buffer.subarray(offset, end));
  }
  return chunks;
}

export function generateTestPcm(
  durationMs: number,
  sampleRate: number,
  options?: {
    frequency?: number;
    amplitude?: number;
    addNoise?: boolean;
    noiseSnr?: number;
  }
): Buffer {
  const wave = generateSineWave(
    durationMs,
    sampleRate,
    options?.frequency || 440,
    options?.amplitude || 0.3
  );

  if (options?.addNoise) {
    const snr = options.noiseSnr || 20;
    const signalPower = 0.3 * 0.3;
    const noisePower = signalPower / Math.pow(10, snr / 10);
    const noiseStd = Math.sqrt(noisePower) * 32767;
    const noisy = Buffer.alloc(wave.length);
    for (let i = 0; i < wave.length; i += 2) {
      const signal = wave.readInt16LE(i);
      const noise = Math.round(gaussianRandom() * noiseStd);
      const clipped = Math.max(-32768, Math.min(32767, signal + noise));
      noisy.writeInt16LE(clipped, i);
    }
    return noisy;
  }

  return wave;
}

function gaussianRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}
