export const CALL_DURATION_MINUTES: Record<string, number> = {
  video: 20,
  audio: 15,
};

export function isTimeBoxed(consultationType: string): boolean {
  return consultationType in CALL_DURATION_MINUTES;
}

export function getRemainingSeconds(startedAt: string | null, consultationType: string): number | null {
  if (!startedAt || !isTimeBoxed(consultationType)) return null;
  const durationSeconds = CALL_DURATION_MINUTES[consultationType] * 60;
  const elapsedSeconds = (Date.now() - new Date(startedAt).getTime()) / 1000;
  return Math.max(0, Math.round(durationSeconds - elapsedSeconds));
}

export function isCallExpired(startedAt: string | null, consultationType: string): boolean {
  const remaining = getRemainingSeconds(startedAt, consultationType);
  return remaining !== null && remaining <= 0;
}

export function formatRemaining(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
