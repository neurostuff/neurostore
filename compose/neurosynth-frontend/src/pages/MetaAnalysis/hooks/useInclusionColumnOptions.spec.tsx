import { renderHook } from '@testing-library/react';
import { useGetAnnotationById } from 'hooks';
import { NoteCollectionReturn } from 'neurostore-typescript-sdk';
import { Mock, vi } from 'vitest';
import useInclusionColumnOptions from './useInclusionColumnOptions';

vi.mock('hooks');

describe('useInclusionColumnOptions', () => {
    it('should return an empty object when the annotation or column is missing', () => {
        (useGetAnnotationById as Mock).mockReturnValue({ data: undefined });

        const { result } = renderHook(() => useInclusionColumnOptions('annotation-id', 'group'));

        expect(result.current).toEqual({});
    });

    it('should count unique studies for each annotation value', () => {
        const notes: NoteCollectionReturn[] = [
            { study: 'study-1', analysis: 'analysis-1', note: { group: 'abc' } },
            { study: 'study-1', analysis: 'analysis-2', note: { group: 'abc' } },
            { study: 'study-2', analysis: 'analysis-3', note: { group: 'abc' } },
            { study: 'study-3', analysis: 'analysis-4', note: { group: 'def' } },
            { study: 'study-4', analysis: 'analysis-5', note: { group: 'ghi' } },
        ];
        (useGetAnnotationById as Mock).mockReturnValue({ data: { notes } });

        const { result } = renderHook(() => useInclusionColumnOptions('annotation-id', 'group'));

        expect(result.current).toEqual({ abc: 2, def: 1, ghi: 1 });
    });
});
