import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CellContext } from '@tanstack/react-table';
import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
import type { NoteKeyType } from 'components/HotTables/HotTables.types';
import AnnotationBaseInputCell from 'pages/StudyIBMA/components/AnnotationInputCells';
import type { AnalysisBoardRow } from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpdateAnnotationCell = vi.fn();

const buildCellProps = (
    columnNoteKey: NoteKeyType,
    value: string | boolean | number | null
): CellContext<AnalysisBoardRow, string | boolean | number | null> =>
    ({
        row: {
            id: 'analysis-1',
            original: {
                id: 'analysis-1',
                name: '',
                description: '',
                analysisAnnotation: { [columnNoteKey.key]: value },
            } satisfies AnalysisBoardRow,
        },
        column: {
            id: columnNoteKey.key,
            columnDef: {
                meta: { editStudyAnalysisTableNoteKey: columnNoteKey },
            },
        },
        table: {
            options: {
                meta: {
                    updateAnnotationCell: mockUpdateAnnotationCell,
                },
            },
        },
        getValue: () => value,
    }) as unknown as CellContext<AnalysisBoardRow, string | boolean | number | null>;

describe('AnnotationBaseInputCell', () => {
    beforeEach(() => {
        mockUpdateAnnotationCell.mockClear();
    });

    it('commits boolean annotation changes via table meta', async () => {
        render(
            <AnnotationBaseInputCell
                {...buildCellProps({ key: 'included', type: EPropertyType.BOOLEAN, order: 0 }, false)}
            />
        );
        await userEvent.click(screen.getByRole('checkbox', { name: 'included' }));
        expect(mockUpdateAnnotationCell).toHaveBeenCalledWith({
            analysisId: 'analysis-1',
            columnKey: 'included',
            value: true,
        });
        expect(typeof mockUpdateAnnotationCell.mock.calls[0][0].value).toBe('boolean');
    });

    it('commits string annotation on blur with a string value', async () => {
        render(
            <AnnotationBaseInputCell
                {...buildCellProps({ key: 'notes', type: EPropertyType.STRING, order: 0 }, 'Initial notes')}
            />
        );

        const input = screen.getByRole('textbox');
        expect(input).toHaveValue('Initial notes');

        await userEvent.clear(input);
        await userEvent.type(input, 'Updated notes');
        await userEvent.tab();

        expect(mockUpdateAnnotationCell).toHaveBeenCalledWith({
            analysisId: 'analysis-1',
            columnKey: 'notes',
            value: 'Updated notes',
        });
        expect(typeof mockUpdateAnnotationCell.mock.calls[0][0].value).toBe('string');
    });

    it('commits null when a string annotation is cleared on blur', async () => {
        render(
            <AnnotationBaseInputCell
                {...buildCellProps({ key: 'notes', type: EPropertyType.STRING, order: 0 }, 'Initial notes')}
            />
        );

        const input = screen.getByRole('textbox');
        await userEvent.clear(input);
        await userEvent.tab();

        expect(mockUpdateAnnotationCell).toHaveBeenCalledWith({
            analysisId: 'analysis-1',
            columnKey: 'notes',
            value: null,
        });
    });

    it('commits number annotation on blur with a number value', async () => {
        render(
            <AnnotationBaseInputCell {...buildCellProps({ key: 'weight', type: EPropertyType.NUMBER, order: 0 }, 42)} />
        );

        const input = screen.getByRole('spinbutton');
        expect(input).toHaveValue(42);

        await userEvent.clear(input);
        await userEvent.type(input, '7');
        await userEvent.tab();

        expect(mockUpdateAnnotationCell).toHaveBeenCalledWith({
            analysisId: 'analysis-1',
            columnKey: 'weight',
            value: 7,
        });
        expect(typeof mockUpdateAnnotationCell.mock.calls[0][0].value).toBe('number');
    });

    it('commits null when a number annotation is cleared on blur', async () => {
        render(
            <AnnotationBaseInputCell {...buildCellProps({ key: 'weight', type: EPropertyType.NUMBER, order: 0 }, 42)} />
        );

        const input = screen.getByRole('spinbutton');
        await userEvent.clear(input);
        await userEvent.tab();

        expect(mockUpdateAnnotationCell).toHaveBeenCalledWith({
            analysisId: 'analysis-1',
            columnKey: 'weight',
            value: null,
        });
    });
});
