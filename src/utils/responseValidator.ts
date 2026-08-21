import type { VerboseTranscriptionResponse, TranscriptionResponse } from '../types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateVerboseJson(body: any): ValidationResult {
  const errors: string[] = [];

  if (!body) return { valid: false, errors: ['Response body is null/undefined'] };

  // Must have text
  if (typeof body.text !== 'string' || body.text.length === 0) {
    errors.push('text is missing or empty');
  }

  // Must have audio_duration
  if (typeof body.audio_duration !== 'number' || body.audio_duration <= 0) {
    errors.push('audio_duration is missing or not a positive number');
  }

  // Must have inference_time_ms
  if (typeof body.inference_time_ms !== 'number' || body.inference_time_ms <= 0) {
    errors.push('inference_time_ms is missing or not a positive number');
  }

  // Must have request_id
  if (typeof body.request_id !== 'string' || body.request_id.length === 0) {
    errors.push('request_id is missing or empty');
  }

  // Must have success
  if (body.success !== true && body.success !== false) {
    errors.push('success is missing or not boolean');
  }

  // Must have segments array
  if (!Array.isArray(body.segments)) {
    errors.push('segments is missing or not an array');
  } else {
    body.segments.forEach((seg: any, i: number) => {
      if (typeof seg.start !== 'number') errors.push(`segments[${i}].start is not a number`);
      if (typeof seg.end !== 'number') errors.push(`segments[${i}].end is not a number`);
      if (typeof seg.text !== 'string') errors.push(`segments[${i}].text is not a string`);
      if (i > 0 && seg.start < body.segments[i - 1].start) {
        errors.push(`segments[${i}].start is out of order`);
      }
    });
  }

  // Must have words array
  if (!Array.isArray(body.words)) {
    errors.push('words is missing or not an array');
  }

  // Check for extra fields
  const allowedFields = [
    'text', 'audio_duration', 'inference_time_ms', 'request_id',
    'success', 'segments', 'words', 'speakers', 'speaker_turns',
    'detected_language', 'detected_language_name',
  ];
  for (const field of Object.keys(body)) {
    if (!allowedFields.includes(field)) {
      errors.push(`unexpected field: ${field}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateJsonResponse(body: any): ValidationResult {
  const errors: string[] = [];

  if (!body) return { valid: false, errors: ['Response body is null/undefined'] };

  // json format must have "text"
  if (typeof body.text !== 'string') {
    errors.push('text is missing or not a string');
  }

  // Should NOT have verbose fields
  const verboseFields = ['segments', 'words', 'audio_duration', 'inference_time_ms', 'request_id', 'speakers', 'speaker_turns'];
  for (const field of verboseFields) {
    if (field in body) {
      errors.push(`unexpected verbose field "${field}" in json response format`);
    }
  }

  // Allowed fields in simple json response
  const allowedFields = ['text', 'detected_language', 'detected_language_name'];
  for (const field of Object.keys(body)) {
    if (!allowedFields.includes(field)) {
      errors.push(`unexpected field in json response: ${field}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function checkErrorShape(body: any, expectedStatus: number): ValidationResult {
  const errors: string[] = [];

  if (!body) return { valid: false, errors: ['Error body is null/undefined'] };

  // All errors should have { detail: "..." }
  if (typeof body.detail !== 'string' || body.detail.length === 0) {
    errors.push(`error body missing "detail" field: ${JSON.stringify(body)}`);
  }

  return { valid: errors.length === 0, errors };
}

export function checkContentType(headers: Record<string, string>, expected: string): ValidationResult {
  const ct = headers['content-type'] || '';
  return ct.includes(expected)
    ? { valid: true, errors: [] }
    : { valid: false, errors: [`Expected content-type "${expected}", got "${ct}"`] };
}
