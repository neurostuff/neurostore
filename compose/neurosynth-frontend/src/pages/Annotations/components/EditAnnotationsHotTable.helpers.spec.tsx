import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
import styles from 'components/HotTables/HotTables.module.css';
import { createColumnHeader } from './EditAnnotationsHotTable.helpers';

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

    it('omits the remove button when removal is not allowed', () => {
        const html = createColumnHeader('included', EPropertyType.BOOLEAN, false);

        expect(html).toContain('included');
        expect(html).not.toContain(styles['column-header-remove']);
        expect(html).not.toContain(styles['remove-column-icon']);
    });
});
