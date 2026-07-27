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
  return new Date().toISOString();
}

export function fileSizeInMB(filePath: string): number {
  const resolved = resolveAudioPath(filePath);
  if (!fs.existsSync(resolved)) return 0;
  const stats = fs.statSync(resolved);
  return stats.size / (1024 * 1024);
}
