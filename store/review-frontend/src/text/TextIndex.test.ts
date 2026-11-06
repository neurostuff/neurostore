import { TextIndex } from './TextIndex';

function paragraph(html: string) {
    const root = document.createElement('div');
    root.innerHTML = html;
    return { root, p: root.querySelector('p')! };
}

describe('TextIndex.fromPoint', () => {
    it('counts only the text of the paragraph, not the card set after the boundary', () => {
        const { root, p } = paragraph('<p>abcdef<span data-text-aside>CARD TEXT</span>ghi</p>');
        const index = TextIndex.build(root);
        expect(index.fromPoint(p, 0)).toBe(0);
        expect(index.fromPoint(p, 1)).toBe(6);
        expect(index.fromPoint(p, 2)).toBe(6);
        expect(index.fromPoint(p, 3)).toBe(9);
    });

    it('gives the offset of a boundary on a text node the index holds', () => {
        const { root, p } = paragraph('<p>abcdef<span data-text-aside>CARD TEXT</span>ghi</p>');
        const index = TextIndex.build(root);
        expect(index.fromPoint(p.lastChild!, 2)).toBe(8);
    });

    it('refuses a point inside a card', () => {
        const { root } = paragraph('<p>abcdef<span data-text-aside>CARD TEXT</span>ghi</p>');
        const index = TextIndex.build(root);
        const card = root.querySelector('[data-text-aside]')!;
        expect(index.fromPoint(card.firstChild!, 2)).toBeNull();
        expect(index.fromPoint(card, 0)).toBeNull();
    });
});
