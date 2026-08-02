import { filterKeyValueRowsByFieldQuery, type KeyValueRow } from 'pages/StudyIBMA/components/BrainMapDetailPanel';

const rows: KeyValueRow[] = [
    { key: 'filename', value: 'map.nii.gz' },
    { key: 'value_type', value: 'Z' },
    { key: 'map_type', value: 'T' },
    { key: 'modality', value: 'fMRI' },
];

describe('filterKeyValueRowsByFieldQuery', () => {
    it('returns all rows when the query is empty or whitespace', () => {
        expect(filterKeyValueRowsByFieldQuery(rows, '')).toHaveLength(4);
        expect(filterKeyValueRowsByFieldQuery(rows, '   ')).toHaveLength(4);
    });

    it('filters rows by field key case-insensitively', () => {
        const filtered = filterKeyValueRowsByFieldQuery(rows, 'type');
        expect(filtered.map((row) => row.key)).toEqual(['value_type', 'map_type']);
    });

    it('returns no rows when nothing matches', () => {
        expect(filterKeyValueRowsByFieldQuery(rows, 'nonexistent')).toEqual([]);
    });
});
