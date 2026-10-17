import '@testing-library/jest-dom/vitest';
import { setSchemas } from '../contract/schemas';
import { GOLDEN_SCHEMAS } from './goldenSchemas';
import { installHighlightAdapter } from './highlights';

setSchemas(GOLDEN_SCHEMAS);

const isDom = typeof window !== 'undefined';

if (isDom && !Range.prototype.getBoundingClientRect) {
    Range.prototype.getBoundingClientRect = () => new DOMRect();
}

if (isDom && !Range.prototype.getClientRects) {
    Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
}

beforeEach(() => {
    setSchemas(GOLDEN_SCHEMAS);
    if (isDom) installHighlightAdapter();
});
afterEach(() => vi.restoreAllMocks());
