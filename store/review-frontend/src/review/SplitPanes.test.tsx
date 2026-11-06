import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Profiler } from 'react';
import { useReviewStores } from '../store/context';
import { makeBundle } from '../test/bundles';
import { renderWithStores } from '../test/render';
import { useShortcuts, type Shortcut } from './shortcuts';
import { SplitPanes } from './SplitPanes';

const WIDTH = 1500;

/** Gives every element `width` pixels from the left edge, as the split's container measures them. */
function layOut(width = WIDTH) {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, 0, width, 800));
}

function setup(viewer = 'u1') {
    const result = render(<SplitPanes viewer={viewer} text={<p>the paper</p>} inspector={<p>the inspector</p>} />);
    return { ...result, divider: screen.getByRole('separator', { name: 'Resize the text and the review panes' }) };
}

/** Stands in for ResizeObserver, keeping the elements observed; returns a resize of every one of them to `width`. */
function observeResizes() {
    const observers: { callback: () => void; elements: Element[] }[] = [];
    vi.stubGlobal(
        'ResizeObserver',
        class {
            private readonly observer: (typeof observers)[number];
            constructor(callback: () => void) {
                this.observer = { callback, elements: [] };
                observers.push(this.observer);
            }
            observe(element: Element) {
                this.observer.elements.push(element);
            }
            disconnect() {
                this.observer.elements = [];
            }
        }
    );
    return (width: number) => {
        layOut(width);
        act(() => observers.filter((o) => o.elements.length > 0).forEach((o) => o.callback()));
    };
}

let resizeTo: (width: number) => void;

const MAX = Math.floor(((WIDTH - 320 - 6) / WIDTH) * 100);
const share = (divider: HTMLElement) => Number(divider.getAttribute('aria-valuenow'));

beforeEach(() => {
    localStorage.clear();
    layOut();
    resizeTo = observeResizes();
});

afterEach(() => vi.unstubAllGlobals());

describe('the divider between the text and the inspector', () => {
    it('is a vertical separator giving the text pane’s share in percent, 60 at first', () => {
        const { divider } = setup();
        expect(divider).toHaveAttribute('aria-orientation', 'vertical');
        expect(share(divider)).toBe(60);
        expect(divider).toHaveAttribute('aria-valuemin', '30');
        expect(divider).toHaveAttribute('aria-valuemax', String(MAX));
        expect(divider).toHaveAttribute('tabindex', '0');
    });

    it('moves 2% with the arrow keys and 10% with Shift held', () => {
        const { divider } = setup();
        fireEvent.keyDown(divider, { key: 'ArrowRight' });
        expect(share(divider)).toBe(62);
        fireEvent.keyDown(divider, { key: 'ArrowLeft', shiftKey: true });
        expect(share(divider)).toBe(52);
        fireEvent.keyDown(divider, { key: 'ArrowLeft' });
        expect(share(divider)).toBe(50);
        fireEvent.keyDown(divider, { key: 'ArrowRight', shiftKey: true });
        expect(share(divider)).toBe(60);
    });

    it('jumps to the limits with Home and End', () => {
        const { divider } = setup();
        fireEvent.keyDown(divider, { key: 'Home' });
        expect(share(divider)).toBe(30);
        fireEvent.keyDown(divider, { key: 'End' });
        expect(share(divider)).toBe(MAX);
    });

    it('goes back to 60/40 on a double click', () => {
        const { divider } = setup();
        fireEvent.keyDown(divider, { key: 'Home' });
        fireEvent.doubleClick(divider);
        expect(share(divider)).toBe(60);
    });

    it('keeps the inspector 320 pixels wide and the text 30%, whichever binds, as the window is resized', () => {
        const { divider } = setup();
        fireEvent.keyDown(divider, { key: 'End' });
        resizeTo(800);
        expect(share(divider)).toBe(59);
        expect(divider).toHaveAttribute('aria-valuemax', '59');
        fireEvent.keyDown(divider, { key: 'ArrowRight' });
        expect(share(divider)).toBe(59);
        resizeTo(400);
        expect(share(divider)).toBe(30);
        fireEvent.keyDown(divider, { key: 'ArrowLeft', shiftKey: true });
        expect(share(divider)).toBe(30);
    });

    it('moves with the arrows from the share shown, not the one kept beyond the limit', () => {
        const { divider } = setup();
        fireEvent.keyDown(divider, { key: 'End' });
        resizeTo(800);
        fireEvent.keyDown(divider, { key: 'ArrowLeft' });
        expect(share(divider)).toBe(57);
    });

    it('applies the limits again when its container is resized and the window is not', () => {
        const { divider } = setup();
        const onWindowResize = vi.fn();
        window.addEventListener('resize', onWindowResize);
        resizeTo(500);
        window.removeEventListener('resize', onWindowResize);
        expect(onWindowResize).not.toHaveBeenCalled();
        expect(share(divider)).toBe(34);
    });

    it('shows a column-resize cursor', () => {
        const { divider } = setup();
        expect(getComputedStyle(divider).cursor).toBe('col-resize');
    });

    it('keeps the share it was given through a narrower window', () => {
        const { divider } = setup();
        fireEvent.keyDown(divider, { key: 'ArrowRight', shiftKey: true });
        resizeTo(700);
        expect(share(divider)).toBe(53);
        resizeTo(WIDTH);
        expect(share(divider)).toBe(70);
    });
});

describe('dragging the divider', () => {
    /** Holds animation frames until `flush` runs them. */
    function holdFrames() {
        let frames: FrameRequestCallback[] = [];
        const requested = vi
            .spyOn(window, 'requestAnimationFrame')
            .mockImplementation((callback) => frames.push(callback));
        vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
        const flush = () => {
            const due = frames;
            frames = [];
            act(() => due.forEach((callback) => callback(0)));
        };
        return { flush, requested };
    }

    /** Stands in for the PointerEvent jsdom lacks, so a fired pointer event keeps its id and position. */
    function pointerEvents() {
        vi.stubGlobal(
            'PointerEvent',
            class extends MouseEvent {
                readonly pointerId: number;
                constructor(type: string, init: PointerEventInit = {}) {
                    super(type, init);
                    this.pointerId = init.pointerId ?? 0;
                }
            }
        );
    }

    function dragSetup() {
        pointerEvents();
        const { flush, requested } = holdFrames();
        const capture = vi.fn();
        Element.prototype.setPointerCapture = capture;
        const commits = vi.fn();
        const result = render(
            <Profiler id="split" onRender={commits}>
                <SplitPanes viewer="u1" text={<p>the paper</p>} inspector={<p>the inspector</p>} />
            </Profiler>
        );
        const divider = screen.getByRole('separator');
        const container = divider.parentElement!;
        const cssShare = () => container.style.getPropertyValue('--text-share');
        return { ...result, flush, requested, capture, commits, divider, cssShare };
    }

    afterEach(() => {
        delete (Element.prototype as { setPointerCapture?: unknown }).setPointerCapture;
    });

    it('sets the text pane’s share from where the pointer is, clamped to the limits, and keeps it', () => {
        const { flush, capture, divider, cssShare } = dragSetup();
        fireEvent.pointerDown(divider, { pointerId: 7, clientX: 900 });
        expect(capture).toHaveBeenCalledWith(7);
        expect(divider).toHaveAttribute('data-dragging');
        fireEvent.pointerMove(divider, { pointerId: 7, clientX: 750 });
        flush();
        expect(cssShare()).toBe('50%');
        fireEvent.pointerMove(divider, { pointerId: 7, clientX: 30 });
        flush();
        expect(cssShare()).toBe('30%');
        fireEvent.pointerUp(divider, { pointerId: 7, clientX: 30 });
        expect(divider).not.toHaveAttribute('data-dragging');
        expect(share(divider)).toBe(30);
    });

    it('writes the share once a frame, the last place the pointer moved to', () => {
        const { flush, requested, divider, cssShare } = dragSetup();
        fireEvent.pointerDown(divider, { pointerId: 1, clientX: 900 });
        fireEvent.pointerMove(divider, { pointerId: 1, clientX: 600 });
        fireEvent.pointerMove(divider, { pointerId: 1, clientX: 750 });
        expect(requested).toHaveBeenCalledTimes(1);
        expect(cssShare()).toBe('60%');
        flush();
        expect(cssShare()).toBe('50%');
    });

    it('renders nothing again between the pointer going down and coming up', () => {
        const { flush, commits, divider } = dragSetup();
        fireEvent.pointerDown(divider, { pointerId: 1, clientX: 900 });
        commits.mockClear();
        for (const clientX of [800, 700, 600]) {
            fireEvent.pointerMove(divider, { pointerId: 1, clientX });
            flush();
        }
        expect(commits).not.toHaveBeenCalled();
        fireEvent.pointerUp(divider, { pointerId: 1, clientX: 600 });
        expect(commits).toHaveBeenCalled();
    });

    it('ends a drag the browser cancels, keeping the share it reached', () => {
        const { flush, divider, cssShare, unmount } = dragSetup();
        fireEvent.pointerDown(divider, { pointerId: 1, clientX: 900 });
        fireEvent.pointerMove(divider, { pointerId: 1, clientX: 750 });
        flush();
        fireEvent.pointerCancel(divider, { pointerId: 1 });
        expect(divider).not.toHaveAttribute('data-dragging');
        fireEvent.pointerMove(divider, { pointerId: 1, clientX: 1050 });
        flush();
        expect(cssShare()).toBe('50%');
        expect(share(divider)).toBe(50);
        unmount();
        expect(share(setup().divider)).toBe(50);
    });

    it('remembers where the drag ends', () => {
        const { flush, divider, unmount } = dragSetup();
        fireEvent.pointerDown(divider, { pointerId: 1, clientX: 900 });
        fireEvent.pointerMove(divider, { pointerId: 1, clientX: 1050 });
        flush();
        fireEvent.pointerUp(divider, { pointerId: 1, clientX: 1050 });
        expect(share(divider)).toBe(70);
        unmount();
        expect(share(setup().divider)).toBe(70);
    });

    it('does nothing on a pointer moving over it without a drag', () => {
        const { flush, divider, cssShare } = dragSetup();
        fireEvent.pointerMove(divider, { pointerId: 1, clientX: 600 });
        flush();
        expect(cssShare()).toBe('60%');
    });
});

describe('the text pane’s share', () => {
    it('is remembered for each viewer', () => {
        const first = setup('u1');
        fireEvent.keyDown(first.divider, { key: 'ArrowLeft', shiftKey: true });
        first.unmount();
        expect(share(setup('u1').divider)).toBe(50);
        cleanup();
        expect(share(setup('u2').divider)).toBe(60);
    });

    it('is remembered after a double click puts it back', () => {
        const first = setup();
        fireEvent.keyDown(first.divider, { key: 'Home' });
        fireEvent.doubleClick(first.divider);
        first.unmount();
        expect(share(setup().divider)).toBe(60);
    });

    it.each(['not json', '"70"', '-5', '{"share":70}'])('is 60 where the browser holds %s', (kept) => {
        localStorage.setItem('neurostore-review:text-share:v1:u1', kept);
        expect(share(setup().divider)).toBe(60);
    });

    it('is 60, and still moves, where the browser’s storage throws', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new DOMException('denied', 'SecurityError');
        });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('full', 'QuotaExceededError');
        });
        const { divider } = setup();
        expect(share(divider)).toBe(60);
        fireEvent.keyDown(divider, { key: 'ArrowRight' });
        expect(share(divider)).toBe(62);
    });
});

describe('the divider’s keys', () => {
    it('do not run the review shortcuts bound to them', () => {
        const run = vi.fn();
        const table: Shortcut[] = [
            {
                keys: ['ArrowLeft', 'ArrowRight', 'Shift+ArrowLeft', 'Shift+ArrowRight', 'Home', 'End'],
                label: 'stand-in',
                run,
            },
        ];
        function WithShortcuts() {
            useShortcuts(useReviewStores(), table, () => true);
            return <SplitPanes viewer="u1" text={<p>the paper</p>} inspector={<p>the inspector</p>} />;
        }
        renderWithStores(<WithShortcuts />, makeBundle({}, 'A paper.'));
        const divider = screen.getByRole('separator');
        for (const init of [
            { key: 'ArrowLeft' },
            { key: 'ArrowLeft', shiftKey: true },
            { key: 'ArrowRight' },
            { key: 'ArrowRight', shiftKey: true },
            { key: 'Home' },
            { key: 'End' },
        ])
            fireEvent.keyDown(divider, init);
        expect(run).not.toHaveBeenCalled();
        fireEvent.keyDown(document.body, { key: 'ArrowRight' });
        expect(run).toHaveBeenCalledTimes(1);
    });
});
