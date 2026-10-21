export const INTRO_SESSION_KEY = 'wa-jeun-intro-played';
export const INTRO_REPLAY_EVENT = 'wa-jeun:replay-intro';

export function requestIntroReplay(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(INTRO_REPLAY_EVENT));
}

export function markIntroSessionPlayed(storage: Pick<Storage, 'setItem'> | null): void {
  try {
    storage?.setItem(INTRO_SESSION_KEY, 'true');
  } catch {
    // A storage restriction should never prevent access to the site or the replay.
  }
}

/** Claims the intro once for this browser session. Storage failures fail open. */
export function claimIntroSession(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null,
  prefersReducedMotion: boolean,
): boolean {
  if (!storage || prefersReducedMotion) return false;

  try {
    if (storage.getItem(INTRO_SESSION_KEY) === 'true') return false;
    storage.setItem(INTRO_SESSION_KEY, 'true');
    return true;
  } catch {
    return false;
  }
}
