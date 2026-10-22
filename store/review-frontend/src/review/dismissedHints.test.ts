import { readDismissed, writeDismissed } from './dismissedHints';

const KEY = 'neurostore-review:dismissed-step-hints:v1';

describe('the dismissed step hints', () => {
    beforeEach(() => localStorage.clear());

    it('are read as written', () => {
        writeDismissed(['analyses', 'leftovers']);
        expect(readDismissed()).toEqual(['analyses', 'leftovers']);
    });

    it('keep only the ids of steps the review has', () => {
        localStorage.setItem(KEY, JSON.stringify(['analyses', 'retired-step', 7, null, 'leftovers']));
        expect(readDismissed()).toEqual(['analyses', 'leftovers']);
    });

    it.each(['not json', '{"analyses":true}', '"analyses"'])('are none where the browser holds %s', (kept) => {
        localStorage.setItem(KEY, kept);
        expect(readDismissed()).toEqual([]);
    });
});
