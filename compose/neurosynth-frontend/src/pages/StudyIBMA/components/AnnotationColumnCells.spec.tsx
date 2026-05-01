import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CellContext } from '@tanstack/react-table';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
import { AnnotationColumnCell } from './AnnotationColumnCells';
import type { AnalysisBoardRow } from '../hooks/useEditStudyAnalysisBoardState.types';

const mockUpdateNotes = vi.fn();

vi.mock('stores/annotation/AnnotationStore.actions', () => ({
    useUpdateAnnotationNotes: () => mockUpdateNotes,
}));

vi.mock('stores/annotation/AnnotationStore', () => ({
    useAnnotationStore: {
        getState: () => ({
            annotation: {
                notes: [
                    {
                        analysis: 'analysis-1',
                        study: 'study-1',
                        note: { included: false },
                    },
                ],
            },
        }),
    },
}));

describe('AnnotationColumnCell', () => {
    beforeEach(() => {
        mockUpdateNotes.mockClear();
    });

    it('commits boolean annotation changes', () => {
        const columnNoteKey = { key: 'included', type: EPropertyType.BOOLEAN, order: 0 };
        const cellProps = {
            row: {
                id: 'analysis-1',
                original: {
                    id: 'analysis-1',
                    name: '',
                    description: '',
                    annotation: { included: false },
                } satisfies AnalysisBoardRow,
            },
            column: {
                id: 'included',
                columnDef: {
                    meta: { editStudyAnalysisTableNoteKey: columnNoteKey },
                },
            },
            getValue: () => false as const,
        } as unknown as CellContext<AnalysisBoardRow, string | boolean | number | null>;

        render(<AnnotationColumnCell {...cellProps} />);
        userEvent.click(screen.getByRole('checkbox', { name: 'included' }));
        expect(mockUpdateNotes).toHaveBeenCalledTimes(1);
        expect(mockUpdateNotes).toHaveBeenCalledWith([
            {
                analysis: 'analysis-1',
                study: 'study-1',
                note: { included: true },
                isEdited: true,
            },
        ]);
    });
});
