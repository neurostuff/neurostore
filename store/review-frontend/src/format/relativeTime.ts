const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** How long before `now` the instant `iso` was, in the words a list uses; a date from a month back. */
export function relativeTime(iso: string, now: Date): string {
    const elapsed = now.getTime() - new Date(iso).getTime();
    if (elapsed < MINUTE) return 'just now';
    if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;
    if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} h ago`;
    if (elapsed < 30 * DAY) return `${Math.floor(elapsed / DAY)} d ago`;
    return iso.slice(0, 10);
}
