import type { CandidateConfidence } from './types.js';

export function clampScore(score: number): number {
  if (Number.isNaN(score)) return 0;
  return Math.max(0, Math.min(1, Number(score.toFixed(4))));
}

export function confidenceFromScore(score: number): CandidateConfidence {
  if (score >= 0.8) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}