/**
 * Character Error Rate (CER) Calculator
 * CER = (Substitutions + Deletions + Insertions) / Reference Characters
 * Uses Levenshtein distance at the character level.
 * Capped at 5000 chars to avoid OOM on long audio.
 */
const MAX_CER_CHARS = 5000;

export function calculateCER(reference: string, hypothesis: string): number {
  const refChars = normalizeText(reference).slice(0, MAX_CER_CHARS).split('');
  const hypChars = normalizeText(hypothesis).slice(0, MAX_CER_CHARS).split('');

  if (refChars.length === 0) {
    return hypChars.length > 0 ? 1.0 : 0.0;
  }

  const n = refChars.length;
  const m = hypChars.length;

  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (refChars[i - 1] === hypChars[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j - 1] + 1,  // substitution
          dp[i - 1][j] + 1,      // deletion
          dp[i][j - 1] + 1       // insertion
        );
      }
    }
  }

  return Math.min(dp[n][m] / n, 1.0);
}

function normalizeText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ');
}
