import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
import styles from 'components/HotTables/HotTables.module.css';
import { NoteKeyType } from 'components/HotTables/HotTables.types';
import { createColumnHeader, isRemoveColumnButton, moveNoteKeys } from './EditAnnotationsHotTable.helpers';

describe('moveNoteKeys', () => {
    const noteKeys: NoteKeyType[] = ['a', 'b', 'c', 'd'].map((key, index) => ({
        key,
        type: EPropertyType.STRING,
        order: index,
        default: null,
    }));

    it('moves a single note key forward', () => {
        const result = moveNoteKeys(noteKeys, [0], 2);

        expect(result.map((noteKey) => noteKey.key)).toEqual(['b', 'c', 'a', 'd']);
    });

    it('moves a single note key backward', () => {
        const result = moveNoteKeys(noteKeys, [3], 0);

        expect(result.map((noteKey) => noteKey.key)).toEqual(['d', 'a', 'b', 'c']);
    });

    it('moves a block of note keys to the end', () => {
        const result = moveNoteKeys(noteKeys, [0, 1], 2);

        expect(result.map((noteKey) => noteKey.key)).toEqual(['c', 'd', 'a', 'b']);
    });

    it('re-indexes order to match the new position', () => {
        const result = moveNoteKeys(noteKeys, [1], 3);

        expect(result.map((noteKey) => noteKey.order)).toEqual([0, 1, 2, 3]);
        expect(noteKeys.map((noteKey) => noteKey.key)).toEqual(['a', 'b', 'c', 'd']);
    });
});

describe('createColumnHeader', () => {
    it('applies max-width and ellipsis classes so long names do not overlap the remove button', () => {
        const colKey = 'a-very-long-annotation-column-name';
        const html = createColumnHeader(colKey, EPropertyType.BOOLEAN, true);

        expect(html).toContain(`title="${colKey}"`);
        expect(html).toContain(colKey);
        expect(html).toContain(styles['column-header']);
        expect(html).toContain(styles['column-header-label']);
        expect(html).toContain(styles.truncate);
        expect(html).toContain(styles['column-header-remove']);
        expect(html).toContain(styles['remove-column-icon']);
    });

    it.each([
        [EPropertyType.BOOLEAN, styles.boolean],
        [EPropertyType.STRING, styles.string],
        [EPropertyType.NUMBER, styles.number],
    ] as const)('applies the %s type class used for header color', (colType, typeClass) => {
        const html = createColumnHeader('sample_size', colType, true);

        expect(html).toContain(typeClass);
    });

    it('omits the remove button when removal is not allowed', () => {
        const html = createColumnHeader('included', EPropertyType.BOOLEAN, false);

        expect(html).toContain('included');
        expect(html).not.toContain(styles['column-header-remove']);
        expect(html).not.toContain(styles['remove-column-icon']);
    });
});

describe('isRemoveColumnButton', () => {
    const header = document.createElement('div');
    header.innerHTML = createColumnHeader('sample_size', EPropertyType.NUMBER, true);
    const removeButton = header.querySelector(`.${styles['remove-column-icon']}`);

    it('matches the remove button rendered by createColumnHeader', () => {
        expect(isRemoveColumnButton(removeButton)).toBe(true);
    });

    it('does not match the column label or the icon svg', () => {
        expect(isRemoveColumnButton(header.querySelector(`.${styles['column-header-label']}`))).toBe(false);
        expect(isRemoveColumnButton(header.querySelector('svg'))).toBe(false);
        expect(isRemoveColumnButton(null)).toBe(false);
    });
});
