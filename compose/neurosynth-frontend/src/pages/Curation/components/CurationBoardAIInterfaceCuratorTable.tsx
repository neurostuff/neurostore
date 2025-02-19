import {
    Box,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { ICurationBoardAIInterfaceCurator } from './CurationBoardAIInterfaceCurator';
import { ICurationStubStudy } from '../Curation.types';
import { NeurostoreStudyReturn } from 'neurosynth-compose-typescript-sdk';
import { CuratorTableYearCell, CuratorTableYearHeader } from './CurationBoardAIInterfaceCuratorTableYear';
import { CuratorTableAuthorsCell, CuratorTableAuthorsHeader } from './CurationBoardAIInterfaceCuratorTableAuthors';
import { CuratorTableTitleCell, CuratorTableTitleHeader } from './CurationBoardAIInterfaceCuratorTableTitle';
import { CuratorTableJournalCell, CuratorTableJournalHeader } from './CurationBoardAIInterfaceCuratorTableJournal';
import { Add } from '@mui/icons-material';
import { CuratorTableSummaryCell, CuratorTableSummaryHeader } from './CurationBoardAIInterfaceCuratorTableSummary';
import { CuratorTableSelectCell, CuratorTableSelectHeader } from './CurationBoardAIInterfaceCuratorTableSelect';

export type ICurationTableStudy = ICurationStubStudy & { neurostoreStudy?: NeurostoreStudyReturn };
const columnHelper = createColumnHelper<ICurationTableStudy>();

const CurationBoardAIInterfaceCuratorTable: React.FC<ICurationBoardAIInterfaceCurator> = ({
    stubs,
    onSetSelectedStub,
}) => {
    const [columns, setColumns] = useState([
        columnHelper.display({
            id: 'select',
            cell: CuratorTableSelectCell,
            header: CuratorTableSelectHeader,
        }),
        columnHelper.display({
            id: 'summary',
            cell: CuratorTableSummaryCell,
            header: CuratorTableSummaryHeader,
        }),
        columnHelper.accessor(({ articleYear }) => articleYear, {
            id: 'year',
            cell: CuratorTableYearCell,
            header: CuratorTableYearHeader,
            enableSorting: true,
            enableColumnFilter: true,
            filterFn: 'includesString',
            meta: {
                filterVariant: 'text',
            },
        }),
        columnHelper.accessor(({ title }) => title, {
            id: 'title',
            cell: CuratorTableTitleCell,
            header: CuratorTableTitleHeader,
            enableSorting: true,
            enableColumnFilter: true,
            filterFn: 'includesString',
            meta: {
                filterVariant: 'text',
            },
        }),
        columnHelper.accessor(({ authors }) => authors, {
            id: 'authors',
            cell: CuratorTableAuthorsCell,
            header: CuratorTableAuthorsHeader,
            enableSorting: true,
            enableColumnFilter: true,
            filterFn: 'includesString',
            meta: {
                filterVariant: 'text',
            },
        }),
        columnHelper.accessor(({ journal }) => journal, {
            id: 'journal',
            cell: CuratorTableJournalCell,
            header: CuratorTableJournalHeader,
            enableSorting: true,
            enableColumnFilter: true,
            filterFn: 'includesString',
            meta: {
                filterVariant: 'text',
            },
        }),
    ]);

    const data = useMemo(() => {
        return [...stubs];
    }, [stubs]);

    const table = useReactTable({
        data: data,
        columns: columns,
        getCoreRowModel: getCoreRowModel(),
        // onSortingChange: setSorting,
        // onPaginationChange: setPagination,
        // getSortedRowModel: getSortedRowModel(),
        // getPaginationRowModel: getPaginationRowModel(),
        // getFilteredRowModel: getFilteredRowModel(),
        // onColumnFiltersChange: setColumnFilters,
        // autoResetPageIndex: false,
        // state: {
        //     pagination: pagination,
        //     columnFilters: columnFilters,
        //     sorting: sorting,
        // },
    });

    return (
        <Box sx={{ padding: '0 1rem 1rem 1rem', height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button sx={{ width: '180px' }} size="small" startIcon={<Add />} color="secondary">
                    Add Columns
                </Button>
            </Box>
            <TableContainer sx={{ maxHeight: 'calc(100% - 48px - 32px)' }}>
                <Table size="small">
                    <TableHead>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableCell
                                        key={header.id}
                                        sx={{
                                            padding: '4px 8px',
                                            width:
                                                header.column.id === 'name' ? '100%' : `${header.column.getSize()}px`,
                                            verticalAlign: 'bottom',
                                        }}
                                    >
                                        <Box>{flexRender(header.column.columnDef.header, header.getContext())}</Box>
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableHead>
                    <TableBody>
                        {table.getRowModel().rows.map((row) => (
                            <TableRow
                                key={row.id}
                                onClick={() => onSetSelectedStub(row.original.id)}
                                sx={{
                                    transition: 'ease-in 150ms',
                                    '&:hover': {
                                        backgroundColor: '#ebebeb',
                                        cursor: 'pointer',
                                        transition: 'ease-in-out 150ms',
                                    },
                                }}
                            >
                                {row.getVisibleCells().map((cell) => (
                                    <TableCell key={cell.id} sx={{ padding: '4px 8px', lineHeight: 'normal' }}>
                                        <Box>{flexRender(cell.column.columnDef.cell, cell.getContext())}</Box>
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {table.getRowModel().rows.length === 0 && (
                    <Typography sx={{ color: 'warning.dark', margin: '0.5rem 0', fontSize: '12px' }}>
                        No studies. To import studies, click the import button above.
                    </Typography>
                )}
            </TableContainer>
        </Box>
    );
};

export default CurationBoardAIInterfaceCuratorTable;

/**
 * import {
    Box,
    Button,
    Chip,
    Pagination,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    Typography,
} from '@mui/material';
import {
    ColumnFiltersState,
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    PaginationState,
    RowData,
    SortingState,
    useReactTable,
} from '@tanstack/react-table';
import { useGetStudysetById, useUserCanEdit } from 'hooks';
import { IStudyExtractionStatus } from 'hooks/projects/useGetProjects';
import { StudyReturn } from 'neurostore-typescript-sdk';
import {
    useProjectExtractionSetGivenStudyStatusesAsComplete,
    useProjectExtractionStudysetId,
    useProjectExtractionStudyStatusList,
    useProjectId,
    useProjectUser,
} from 'pages/Project/store/ProjectStore';
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EExtractionStatus } from '../ExtractionPage';
import styles from './ExtractionTable.module.css';
import { ExtractionTableAuthorCell, ExtractionTableAuthorHeader } from './ExtractionTableAuthor';
import ExtractionTableFilterInput from './ExtractionTableFilterInput';
import { ExtractionTableJournalCell, ExtractionTableJournalHeader } from './ExtractionTableJournal';
import { ExtractionTableNameCell, ExtractionTableNameHeader } from './ExtractionTableName';
import { ExtractionTablePMIDCell, ExtractionTablePMIDHeader } from './ExtractionTablePMID';
import { ExtractionTableStatusCell, ExtractionTableStatusHeader } from './ExtractionTableStatus';
import { ExtractionTableYearCell, ExtractionTableYearHeader } from './ExtractionTableYear';
import { retrieveExtractionTableState } from './ExtractionTable.helpers';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';

//allows us to define custom properties for our columns
declare module '@tanstack/react-table' {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface ColumnMeta<TData extends RowData, TValue> {
        filterVariant?: 'text' | 'status-select' | 'journal-autocomplete';
    }
}

export type IExtractionTableStudy = StudyReturn & { status: EExtractionStatus | undefined };

const columnHelper = createColumnHelper<IExtractionTableStudy>();

const ExtractionTable: React.FC = () => {
    const studysetId = useProjectExtractionStudysetId();
    const projectId = useProjectId();
    const navigate = useNavigate();
    const studyStatusList = useProjectExtractionStudyStatusList();
    const { data: studyset } = useGetStudysetById(studysetId, true); // this should already be loaded in the cache from the parent component
    const setGivenStudyStatusesAsComplete = useProjectExtractionSetGivenStudyStatusesAsComplete();
    const projectUser = useProjectUser();
    const usercanEdit = useUserCanEdit(projectUser || undefined);

    const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: 25,
    });
    const [confirmationDialogIsOpen, setConfirmationDialogIsOpen] = useState(false);

    useEffect(() => {
        const state = retrieveExtractionTableState(projectId);
        if (!state) return;

        if (state.columnFilters) setColumnFilters(state.columnFilters);
        if (state.sorting) setSorting(state.sorting);
    }, [projectId]);

    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [sorting, setSorting] = useState<SortingState>([]);

    const studyStatusMap = useMemo(() => {
        const map = new Map<string, IStudyExtractionStatus>();
        studyStatusList?.forEach((studyStatus) => {
            map.set(studyStatus.id, studyStatus);
        });
        return map;
    }, [studyStatusList]);

    const data: Array<StudyReturn & { status: EExtractionStatus | undefined }> = useMemo(() => {
        const studies = (studyset?.studies || []) as Array<StudyReturn>;
        return studies.map((study) => ({
            ...study,
            status: studyStatusMap.get(study?.id || '')?.status,
        }));
    }, [studyStatusMap, studyset?.studies]);

    const columns = useMemo(() => {
        return [
            columnHelper.accessor(({ year }) => (year ? String(year) : ''), {
                id: 'year',
                size: 60,
                minSize: 60,
                maxSize: 60,
                cell: ExtractionTableYearCell,
                header: ExtractionTableYearHeader,
                enableSorting: true,
                enableColumnFilter: true,
                filterFn: 'includesString',
                meta: {
                    filterVariant: 'text',
                },
            }),
            columnHelper.accessor('name', {
                id: 'name',
                cell: ExtractionTableNameCell,
                size: 500,
                minSize: 500,
                maxSize: 500,
                header: ExtractionTableNameHeader,
                enableSorting: true,
                sortingFn: 'text',
                filterFn: 'includesString',
                meta: {
                    filterVariant: 'text',
                },
            }),
            columnHelper.accessor('authors', {
                id: 'authors',
                size: 100,
                minSize: 100,
                maxSize: 100,
                enableSorting: true,
                enableColumnFilter: true,
                sortingFn: 'text',
                filterFn: 'includesString',
                cell: ExtractionTableAuthorCell,
                header: ExtractionTableAuthorHeader,
                meta: {
                    filterVariant: 'text',
                },
            }),
            columnHelper.accessor('publication', {
                id: 'journal',
                size: 100,
                minSize: 100,
                maxSize: 100,
                enableSorting: true,
                enableColumnFilter: true,
                cell: ExtractionTableJournalCell,
                header: ExtractionTableJournalHeader,
                meta: {
                    filterVariant: 'journal-autocomplete',
                },
            }),
            columnHelper.accessor('pmid', {
                id: 'pmid',
                size: 80,
                minSize: 80,
                maxSize: 80,
                enableColumnFilter: true,
                filterFn: 'includesString',
                cell: ExtractionTablePMIDCell,
                header: ExtractionTablePMIDHeader,
                enableSorting: true,
                sortingFn: 'alphanumeric',
                meta: {
                    filterVariant: 'text',
                },
            }),
            columnHelper.accessor('status', {
                id: 'status',
                size: 120,
                minSize: 120,
                maxSize: 120,
                enableSorting: true,
                cell: ExtractionTableStatusCell,
                filterFn: (row, columnId, filterValue: EExtractionStatus | null) => {
                    if (filterValue === null) return true;
                    const studyStatus = row.getValue(columnId) as EExtractionStatus | undefined;

                    // uncategorized can be undefined or it can be "uncategorized"
                    if (filterValue === EExtractionStatus.UNCATEGORIZED) {
                        return studyStatus === filterValue || studyStatus === undefined;
                    }

                    return studyStatus === filterValue;
                },
                header: ExtractionTableStatusHeader,
                enableColumnFilter: true,
                meta: {
                    filterVariant: 'status-select',
                },
            }),
        ];
    }, []);

    const table = useReactTable({
        data: data,
        columns: columns,
        onSortingChange: setSorting,
        onPaginationChange: setPagination,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onColumnFiltersChange: setColumnFilters,
        autoResetPageIndex: false,
        state: {
            pagination: pagination,
            columnFilters: columnFilters,
            sorting: sorting,
        },
    });

    const handleRowsPerPageChange = useCallback(
        (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const newRowsPerPage = parseInt(event.target.value);
            if (!isNaN(newRowsPerPage)) setPagination({ pageIndex: 0, pageSize: newRowsPerPage });
        },
        []
    );

    const handleMarkAllAsComplete = useCallback(
        (ok: boolean | undefined) => {
            if (ok) {
                const studies = (studyset?.studies || []) as Array<StudyReturn>;
                setGivenStudyStatusesAsComplete(studies.map((x) => x.id) as string[]);
            }

            setConfirmationDialogIsOpen(false);
        },
        [setGivenStudyStatusesAsComplete, studyset?.studies]
    );

    const handlePaginationChange = useCallback((_event: any, page: number) => {
        // page is 0 indexed
        setPagination((prev) => ({
            ...prev,
            pageIndex: page,
        }));
    }, []);

    // the two pagination functionds act differently so we need to assume different things for each
    const handlePaginationChangeMuiPaginator = useCallback((_event: any, page: number) => {
        // page is 0 indexed
        setPagination((prev) => ({
            ...prev,
            pageIndex: page - 1,
        }));
    }, []);

    return (
        <Box sx={{ marginBottom: '4rem' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Pagination
                    count={table.getPageCount()}
                    siblingCount={3}
                    boundaryCount={3}
                    onChange={handlePaginationChangeMuiPaginator}
                    page={pagination.pageIndex + 1}
                />
                <Box sx={{ width: '271px', display: 'flex', justifyContent: 'flex-end' }}>
                    <ConfirmationDialog
                        onCloseDialog={handleMarkAllAsComplete}
                        rejectText="Cancel"
                        confirmText="Mark all as complete"
                        isOpen={confirmationDialogIsOpen}
                        dialogTitle="Are you sure you want to mark all the studies as complete?"
                        dialogMessage="You can skip reviewing to expedite the process, but any studies you have not reviewed may have incomplete or inaccurate metadata or coordinates."
                    />
                    <Button
                        sx={{ marginLeft: '4px' }}
                        color="success"
                        disableElevation
                        onClick={() => setConfirmationDialogIsOpen(true)}
                    >
                        Mark all as complete
                    </Button>
                </Box>
            </Box>
            <TableContainer sx={{ marginBottom: '2rem' }}>
                <Table
                    size="small"
                    sx={{ tableLayout: 'fixed', width: 'fit-content', minWidth: '800px' }}
                >
                    <TableHead>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableCell
                                        key={header.id}
                                        sx={{
                                            width:
                                                header.column.id === 'name'
                                                    ? '100%'
                                                    : `${header.column.getSize()}px`,
                                            verticalAlign: 'bottom',
                                        }}
                                    >
                                        <Box>
                                            {flexRender(
                                                header.column.columnDef.header,
                                                header.getContext()
                                            )}
                                            {header.column.getCanFilter() ? (
                                                <ExtractionTableFilterInput
                                                    table={table}
                                                    column={header.column}
                                                />
                                            ) : (
                                                <Box sx={{ height: '40px' }}></Box>
                                            )}
                                        </Box>
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableHead>
                    <TableBody>
                        {table.getRowModel().rows.map((row) => (
                            <TableRow
                                key={row.id}
                                className={
                                    styles[
                                        studyStatusMap.get(row.original.id || '')?.status ??
                                            'uncategorized'
                                    ]
                                }
                                onClick={() => {
                                    if (!row.original.id) return;
                                    sessionStorage.setItem(
                                        `${projectId}-extraction-table`,
                                        JSON.stringify({
                                            columnFilters: table.getState().columnFilters,
                                            sorting: table.getState().sorting,
                                            studies: table
                                                .getSortedRowModel()
                                                .rows.map((r) => r.original.id),
                                        })
                                    );

                                    if (usercanEdit) {
                                        navigate(
                                            `/projects/${projectId}/extraction/studies/${row.original.id}/edit`
                                        );
                                    } else {
                                        navigate(
                                            `/projects/${projectId}/extraction/studies/${row.original.id}`
                                        );
                                    }
                                }}
                                sx={{
                                    '&:hover': { filter: 'brightness(0.9)', cursor: 'pointer' },
                                }}
                            >
                                {row.getVisibleCells().map((cell) => (
                                    <TableCell key={cell.id}>
                                        <Box>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </Box>
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
            <Box
                sx={{
                    position: 'sticky',
                    bottom: 0,
                    height: '64px',
                    backgroundColor: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <TablePagination
                    rowsPerPage={pagination.pageSize}
                    onRowsPerPageChange={handleRowsPerPageChange}
                    onPageChange={handlePaginationChange}
                    component="div"
                    rowsPerPageOptions={[10, 25, 50, 100]}
                    page={pagination.pageIndex}
                    count={table.getFilteredRowModel().rows.length}
                />
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box
                        sx={{
                            maxWidth: '40vw',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            flexWrap: 'wrap',
                            marginRight: '1rem',
                        }}
                    >
                        {columnFilters
                            .filter((filter) => !!filter.value)
                            .map((filter) => (
                                <Chip
                                    onDelete={() =>
                                        table.setColumnFilters((prev) =>
                                            prev.filter((f) => f.id !== filter.id)
                                        )
                                    }
                                    key={filter.id}
                                    color="primary"
                                    variant="outlined"
                                    sx={{ margin: '1px', fontSize: '12px', maxWidth: '200px' }}
                                    label={`Filtering ${filter.id.toUpperCase()}: ${filter.value}`}
                                    size="small"
                                />
                            ))}
                        {sorting.map((sort) => (
                            <Chip
                                key={sort.id}
                                onDelete={() => {
                                    table.setSorting((prev) =>
                                        prev.filter((f) => f.id !== sort.id)
                                    );
                                }}
                                color="secondary"
                                variant="outlined"
                                sx={{ margin: '1px', fontSize: '12px', maxWidth: '200px' }}
                                label={`Sorting by ${sort.id.toUpperCase()}: ${
                                    sort.desc ? 'desc' : 'asc'
                                }`}
                                size="small"
                            />
                        ))}
                    </Box>
                    <Box>
                        <Box sx={{ whiteSpace: 'nowrap' }}>
                            {columnFilters.length > 0 ? (
                                <Typography>
                                    Viewing {table.getFilteredRowModel().rows.length} /{' '}
                                    {data.length}
                                </Typography>
                            ) : (
                                <Typography>Total: {data.length} studies</Typography>
                            )}
                        </Box>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};

export default ExtractionTable;

 */
