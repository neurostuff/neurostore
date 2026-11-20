import { relativeTime } from './relativeTime';

/** How long ago the last edit was, and how many ops made it, as a reviewer's line reads. */
export function editSummary(opCount: number, lastEditAt: string, now: Date): string {
    return `last edit ${relativeTime(lastEditAt, now)}, ${opCount} ${opCount === 1 ? 'op' : 'ops'}`;
}
