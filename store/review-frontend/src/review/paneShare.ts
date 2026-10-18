import { readKept, writeKept } from './kept';

/** The text pane's share of the width, in percent, before the reviewer moves the divider. */
export const DEFAULT_SHARE = 60;
export const MIN_SHARE = 30;
export const MIN_INSPECTOR_PX = 320;
/** How far, in percent, an arrow key moves the divider, and Shift with it. */
export const STEP = 2;
export const SHIFT_STEP = 10;

const KEY = 'neurostore-review:text-share:v1';

const keyOf = (viewer: string | undefined) => `${KEY}:${viewer ?? ''}`;

/** The share the viewer left the text pane at on this device; undefined where none is kept. */
export const readShare = (viewer: string | undefined): number | undefined =>
    readKept(keyOf(viewer), (kept) => (typeof kept === 'number' && kept > 0 && kept < 100 ? kept : undefined));

export const writeShare = (viewer: string | undefined, share: number) => writeKept(keyOf(viewer), share);
