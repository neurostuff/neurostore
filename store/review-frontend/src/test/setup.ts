import '@testing-library/jest-dom/vitest';
import { installHighlightAdapter } from './highlights';

const isDom = typeof window !== 'undefined';

if (isDom && !Range.prototype.getBoundingClientRect) {
    Range.prototype.getBoundingClientRect = () => new DOMRect();
}

beforeEach(() => {
    if (isDom) installHighlightAdapter();
});
afterEach(() => vi.restoreAllMocks());
