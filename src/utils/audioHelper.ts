import * as fs from 'fs';
import * as path from 'path';

export function resolveAudioPath(filePath: string): string {
  if (path.isAbsolute(filePath)) return filePath;
  const fromRoot = path.resolve(process.cwd(), filePath);
  if (fs.existsSync(fromRoot)) return fromRoot;
  return path.resolve(process.cwd(), 'input', 'audio', filePath);
}

export function readAudioFile(filePath: string): Buffer {
  const resolved = resolveAudioPath(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Audio file not found: ${resolved}`);
  }
  return fs.readFileSync(resolved);
}

export function openAudioFileStream(filePath: string): fs.ReadStream {
  const resolved = resolveAudioPath(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Audio file not found: ${resolved}`);
  }
  return fs.createReadStream(resolved);
}

export function getLocalDateStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function fileSizeInMB(filePath: string): number {
  const resolved = resolveAudioPath(filePath);
  if (!fs.existsSync(resolved)) return 0;
  const stats = fs.statSync(resolved);
  return stats.size / (1024 * 1024);
}

/**
 * Fast estimation/calculation of audio duration in seconds from file header or size
 */
export function getAudioDurationSeconds(filePath: string): number {
  const resolved = resolveAudioPath(filePath);
  if (!fs.existsSync(resolved)) return 0;
  try {
    const buffer = fs.readFileSync(resolved);
    // WAV Header parsing
    if (buffer.length > 44 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE') {
      const numChannels = buffer.readUInt16LE(22);
      const sampleRate = buffer.readUInt32LE(24);
      const bitsPerSample = buffer.readUInt16LE(34);
      if (numChannels > 0 && sampleRate > 0 && bitsPerSample > 0) {
        const bytesPerSec = sampleRate * numChannels * (bitsPerSample / 8);
        const dataLength = buffer.length - 44;
        return parseFloat((dataLength / bytesPerSec).toFixed(2));
      }
    }
    // MP3/OGG/MPEG general estimate based on average bitrate (128kbps = 16000 bytes/sec)
    const stats = fs.statSync(resolved);
    const estimatedSec = stats.size / 16000;
    return parseFloat(estimatedSec.toFixed(2));
  } catch {
    return 0;
  }
}
