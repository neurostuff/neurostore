import { relativeTime } from './relativeTime';

const now = new Date('2026-10-16T12:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('relativeTime', () => {
    it('says just now under a minute, then minutes, hours and days', () => {
        expect(relativeTime(ago(30_000), now)).toBe('just now');
        expect(relativeTime(ago(5 * MINUTE), now)).toBe('5 min ago');
        expect(relativeTime(ago(2 * HOUR), now)).toBe('2 h ago');
        expect(relativeTime(ago(3 * DAY), now)).toBe('3 d ago');
    });

    it('gives the date instead of a count of days from a month on', () => {
        expect(relativeTime(ago(45 * DAY), now)).toBe('2026-09-01');
    });
});
