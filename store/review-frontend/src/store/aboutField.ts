import { readKept, writeKept } from './kept';

const KEY = 'neurostore-review:about-field-open:v1';

const keyOf = (viewer: string | undefined) => `${KEY}:${viewer ?? ''}`;

/** Whether the viewer left a field's About line open on this device. */
export const readAboutOpen = (viewer: string | undefined): boolean =>
    readKept(keyOf(viewer), (kept) => (typeof kept === 'boolean' ? kept : undefined)) ?? false;

export const writeAboutOpen = (viewer: string | undefined, open: boolean) => writeKept(keyOf(viewer), open);
