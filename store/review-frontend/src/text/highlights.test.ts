import { registeredSpans } from '../test/highlights';
import { HighlightLayer } from './highlights';
import { TextIndex } from './TextIndex';

describe('HighlightLayer', () => {
    it('registers under the names it was built with, so two layers on one page keep apart', () => {
        const root = document.body.appendChild(document.createElement('div'));
        root.textContent = 'one two three four';
        const index = TextIndex.build(root);
        const left = new HighlightLayer(index, {
            focus: 'left-focus',
            evidence: 'left-evidence',
            original: 'left-original',
        });
        const right = new HighlightLayer(index, {
            focus: 'right-focus',
            evidence: 'right-evidence',
            original: 'right-original',
        });
        left.update([[0, 3]], [[4, 7]], []);
        right.update([[8, 13]], [[14, 18]], []);
        right.clear();
        expect(registeredSpans('left-focus', root)).toEqual([[0, 3]]);
        expect(registeredSpans('left-evidence', root)).toEqual([[4, 7]]);
        expect(registeredSpans('right-focus', root)).toEqual([]);
        root.remove();
    });
});
