import { useView } from '../store/context';
import { firstSentence, useDescription } from './fieldHint';

/** The selected field's description: its first sentence on one line and More, or all of it and Less. */
export function FieldAbout({ slot }: { slot: { entity: string; path: string } }) {
    const description = useDescription(slot);
    const open = useView((s) => s.aboutOpen);
    const toggleAbout = useView((s) => s.toggleAbout);
    if (description === undefined) return null;
    const first = firstSentence(description);
    const shown = open || first === description ? description : `${first}…`;
    return (
        <section aria-label="About this field" className="rv-field-about" data-open={open || undefined}>
            <span className="rv-field-about-text">{shown}</span>
            <button
                type="button"
                className="rv-field-about-toggle"
                aria-expanded={open}
                title={open ? 'Show only the first sentence' : 'Show the whole description'}
                onClick={toggleAbout}
            >
                {open ? 'Less' : 'More'}
            </button>
        </section>
    );
}
