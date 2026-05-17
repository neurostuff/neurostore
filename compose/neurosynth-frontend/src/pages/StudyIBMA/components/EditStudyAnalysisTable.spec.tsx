import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
    createColumnHelper,
    getCoreRowModel,
    useReactTable,
    type ExpandedState,
} from '@tanstack/react-table';
import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
import type { NoteKeyType } from 'components/HotTables/HotTables.types';
import type { AnalysisBoardRow } from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.types';
import { EditStudyAnalysisTable } from 'pages/StudyIBMA/components/EditStudyAnalysisTable';
import type { NewAnnotationColumnPayload } from 'pages/StudyIBMA/components/NewAnnotationColumnDialog';
import { useState } from 'react';
import { vi } from 'vitest';

vi.mock('pages/StudyIBMA/components/NewAnnotationColumnDialog');
vi.mock('pages/StudyIBMA/components/EditStudyAnalysisTableRow');
vi.mock('pages/StudyIBMA/components/EditStudyAnalysisMapsExpandedRow');

const columnHelper = createColumnHelper<AnalysisBoardRow>();

const defaultNoteKeys: NoteKeyType[] = [{ key: 'included', type: EPropertyType.BOOLEAN, order: 0 }];

const defaultRow: AnalysisBoardRow = {
    id: 'analysis-1',
    name: 'Contrast A',
    description: 'Motor contrast',
    analysisAnnotation: { included: false },
    images: [],
} as AnalysisBoardRow;

type TableHarnessProps = {
    data?: AnalysisBoardRow[];
    noteKeys?: NoteKeyType[];
    onCreateAnalysis?: () => void;
    onAddAnnotationColumn?: (payload: NewAnnotationColumnPayload) => void;
};

const TableHarness = ({
    data = [defaultRow],
    noteKeys = defaultNoteKeys,
    onCreateAnalysis = vi.fn(),
    onAddAnnotationColumn = vi.fn(),
}: TableHarnessProps) => {
    const [expanded, setExpanded] = useState<ExpandedState>({});

    const table = useReactTable({
        data,
        columns: [
            columnHelper.display({
                id: 'analysis',
                header: () => 'Analyses',
                cell: ({ row }) => row.original.name,
            }),
            ...noteKeys.map((noteKey) =>
                columnHelper.accessor((row) => row.analysisAnnotation[noteKey.key] ?? null, {
                    id: noteKey.key,
                    header: () => noteKey.key,
                    cell: (info) => String(info.getValue() ?? ''),
                })
            ),
        ],
        state: { expanded },
        onExpandedChange: setExpanded,
        getCoreRowModel: getCoreRowModel(),
        getRowId: (row) => row.id ?? '',
        getRowCanExpand: () => true,
    });

    return (
        <EditStudyAnalysisTable
            table={table}
            tableMinWidth={400}
            noteKeys={noteKeys}
            onCreateAnalysis={onCreateAnalysis}
            onAddAnnotationColumn={onAddAnnotationColumn}
        />
    );
};

describe('EditStudyAnalysisTable', () => {
    it('renders the table shell, toolbar actions, and column headers', () => {
        render(<TableHarness />);

        expect(screen.getByTestId('edit-study-analysis-table')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Analysis/i })).toBeInTheDocument();
        expect(screen.getByTestId('new-annotation-column-open-button')).toBeInTheDocument();

        const table = screen.getByRole('table');
        expect(within(table).getByRole('columnheader', { name: 'Analyses' })).toBeInTheDocument();
        expect(within(table).getByRole('columnheader', { name: 'included' })).toBeInTheDocument();
    });

    it('renders a row per analysis with cell values from the table model', () => {
        render(
            <TableHarness
                data={[
                    defaultRow,
                    {
                        ...defaultRow,
                        id: 'analysis-2',
                        name: 'Contrast B',
                        description: '',
                        analysisAnnotation: { included: true },
                    } as AnalysisBoardRow,
                ]}
            />
        );

        const table = screen.getByRole('table');
        expect(within(table).getAllByRole('row')).toHaveLength(3); // header + 2 data rows
        expect(screen.getByTestId('mock-table-row-analysis-1')).toBeInTheDocument();
        expect(screen.getByTestId('mock-table-row-analysis-2')).toBeInTheDocument();
        expect(within(table).getByRole('cell', { name: 'Contrast A' })).toBeInTheDocument();
        expect(within(table).getByRole('cell', { name: 'Contrast B' })).toBeInTheDocument();
        expect(within(table).getByRole('cell', { name: 'false' })).toBeInTheDocument();
        expect(within(table).getByRole('cell', { name: 'true' })).toBeInTheDocument();
    });

    it('does not show the new annotation column dialog until the toolbar button is clicked', async () => {
        render(<TableHarness />);

        expect(screen.queryByTestId('mock-add-column')).not.toBeInTheDocument();

        await userEvent.click(screen.getByTestId('new-annotation-column-open-button'));

        expect(screen.getByTestId('mock-add-column')).toBeInTheDocument();
    });

    it('invokes onCreateAnalysis when + Analysis is clicked', async () => {
        const onCreateAnalysis = vi.fn();
        render(<TableHarness onCreateAnalysis={onCreateAnalysis} />);
        await userEvent.click(screen.getByRole('button', { name: /Analysis/i }));
        expect(onCreateAnalysis).toHaveBeenCalledTimes(1);
    });

    it('invokes onAddAnnotationColumn from new column dialog', async () => {
        const onAddAnnotationColumn = vi.fn();
        render(<TableHarness onAddAnnotationColumn={onAddAnnotationColumn} />);
        await userEvent.click(screen.getByTestId('new-annotation-column-open-button'));
        await userEvent.click(screen.getByTestId('mock-add-column'));
        expect(onAddAnnotationColumn).toHaveBeenCalledWith({
            key: 'new_key',
            type: EPropertyType.BOOLEAN,
            default: false,
        });
    });

    it('renders the expanded maps row when the analysis row is expanded', async () => {
        render(<TableHarness />);

        expect(screen.queryByTestId('mock-expanded-row-analysis-1')).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole('cell', { name: 'Contrast A' }));

        expect(screen.getByTestId('mock-expanded-row-analysis-1')).toBeInTheDocument();
        expect(screen.getByText('mock-expanded-maps')).toBeInTheDocument();
    });

    it('hides the expanded maps row when the analysis row is collapsed', async () => {
        render(<TableHarness />);

        const analysisCell = screen.getByRole('cell', { name: 'Contrast A' });
        await userEvent.click(analysisCell);
        expect(screen.getByTestId('mock-expanded-row-analysis-1')).toBeInTheDocument();

        await userEvent.click(analysisCell);
        expect(screen.queryByTestId('mock-expanded-row-analysis-1')).not.toBeInTheDocument();
    });
});
