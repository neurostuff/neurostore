/** A key pressed, as its keydown gave it. */
export type HeldKey = Pick<
  KeyboardEvent,
  "key" | "shiftKey" | "ctrlKey" | "altKey" | "metaKey"
>;

export const NO_MODIFIERS = {
  shiftKey: false,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
};

/** Whether `key` types a character into a cell, as a keypress on Handsontable's selection does. */
export const typesCharacter = (key: HeldKey) =>
  key.key.length === 1 && !key.ctrlKey && !key.metaKey && !key.altKey;

/** How long a hold lasts at most, should nothing take or end it. */
const HOLD_MS = 3000;
const MODIFIERS = new Set(["Shift", "Control", "Alt", "Meta", "CapsLock"]);
/** The keys held for the grid to carry on; any other ends the hold. */
const CARRIED = new Set(["Backspace", "Enter", "Tab"]);

let held: HeldKey[] = [];
let endHold = () => {};

/** Whether a key on `target` lands on nothing that takes it: the page, as when what had the focus is gone. */
const landsOnNothing = (target: EventTarget | null) =>
  target instanceof Element &&
  (target === target.ownerDocument.body ||
    target === target.ownerDocument.documentElement);

/**
 * Holds the keys pressed on the page from now on, away from the rest of the page, for the grid to take with
 * `takeHeldKeys` once it is mounted. There is one hold at a time: a new one drops the last.
 *
 * Escape, an arrow or any other key that is not a character, Backspace, Enter or Tab is held last, and Escape drops
 * the keys before it. The hold drops its keys and ends on a pointer down, a key on anything but the page, the window
 * losing the focus, the page being hidden, `dropHeldKeys`, or after 3 s.
 */
export function holdKeys(element: Element) {
  dropHeldKeys();
  const document = element.ownerDocument;
  const window = document.defaultView!;
  const keys: HeldKey[] = [];
  const onKeyDown = (event: KeyboardEvent) => {
    if (!landsOnNothing(event.target)) return dropHeldKeys();
    event.preventDefault();
    event.stopImmediatePropagation();
    if (MODIFIERS.has(event.key)) return;
    const { key, shiftKey, ctrlKey, altKey, metaKey } = event;
    if (key === "Escape") keys.length = 0;
    keys.push({ key, shiftKey, ctrlKey, altKey, metaKey });
    if (!typesCharacter(event) && !CARRIED.has(key)) stop();
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") dropHeldKeys();
  };
  const stop = () => {
    document.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("pointerdown", dropHeldKeys, true);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("blur", dropHeldKeys);
  };
  const timeout = window.setTimeout(dropHeldKeys, HOLD_MS);
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("pointerdown", dropHeldKeys, true);
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("blur", dropHeldKeys);
  held = keys;
  endHold = () => {
    stop();
    window.clearTimeout(timeout);
    endHold = () => {};
  };
}

/** The keys held, in the order pressed, once: it ends the hold, and the next take gives none. */
export function takeHeldKeys(): HeldKey[] {
  endHold();
  const keys = held;
  held = [];
  return keys;
}

/** Ends the hold, if there is one, dropping its keys. */
export function dropHeldKeys() {
  takeHeldKeys();
}
