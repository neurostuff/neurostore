import {
    Box,
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
import { useGetStudysetById } from 'hooks';
import { IStudyExtractionStatus } from 'hooks/projects/useGetProjects';
import { StudyReturn } from 'neurostore-typescript-sdk';
import {
    useProjectExtractionStudysetId,
    useProjectExtractionStudyStatusList,
    useProjectId,
} from 'pages/Project/store/ProjectStore';
import { ChangeEvent, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EExtractionStatus } from '../ExtractionPage';
import styles from './ExtractionTable.module.css';
import { ExtractionTableAuthorCell, ExtractionTableAuthorHeader } from './ExtractionTableAuthor';
import { ExtractionTableDOICell, ExtractionTableDOIHeader } from './ExtractionTableDOI';
import ExtractionTableFilterInput from './ExtractionTableFilterInput';
import { ExtractionTableJournalCell, ExtractionTableJournalHeader } from './ExtractionTableJournal';
import { ExtractionTableNameCell, ExtractionTableNameHeader } from './ExtractionTableName';
import { ExtractionTablePMIDCell, ExtractionTablePMIDHeader } from './ExtractionTablePMID';
import { ExtractionTableStatusCell, ExtractionTableStatusHeader } from './ExtractionTableStatus';
import { ExtractionTableYearCell, ExtractionTableYearHeader } from './ExtractionTableYear';

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

    const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: 25,
    });
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
                size: 5,
                minSize: 5,
                maxSize: 5,
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
                size: 25,
                minSize: 25,
                maxSize: 25,
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
                size: 20,
                minSize: 20,
                maxSize: 20,
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
                size: 15,
                minSize: 15,
                maxSize: 15,
                enableSorting: true,
                enableColumnFilter: true,
                cell: ExtractionTableJournalCell,
                header: ExtractionTableJournalHeader,
                meta: {
                    filterVariant: 'journal-autocomplete',
                },
            }),
            columnHelper.accessor('doi', {
                id: 'doi',
                size: 15,
                minSize: 15,
                maxSize: 15,
                enableSorting: true,
                enableColumnFilter: true,
                filterFn: 'includesString',
                cell: ExtractionTableDOICell,
                header: ExtractionTableDOIHeader,
                meta: {
                    filterVariant: 'text',
                },
            }),
            columnHelper.accessor('pmid', {
                id: 'pmid',
                size: 10,
                minSize: 10,
                maxSize: 10,
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
                size: 10,
                minSize: 10,
                maxSize: 10,
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
        state: {
            pagination: pagination,
            columnFilters: columnFilters,
            sorting: sorting,
        },
        meta: {
            studyStatusMap,
        },
    });

    const handleRowsPerPageChange = useCallback(
        (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const newRowsPerPage = parseInt(event.target.value);
            if (!isNaN(newRowsPerPage)) setPagination({ pageIndex: 0, pageSize: newRowsPerPage });
        },
        []
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
                <Typography variant="h5">Total: {data.length} studies</Typography>
            </Box>
            <TableContainer sx={{ marginBottom: '2rem' }}>
                <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
                    <TableHead>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableCell
                                        key={header.id}
                                        sx={{ width: `${header.column.getSize()}%` }}
                                    >
                                        <Box>
                                            {flexRender(
                                                header.column.columnDef.header,
                                                header.getContext()
                                            )}
                                            {header.column.getCanFilter() ? (
                                                <ExtractionTableFilterInput
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
                                            filters: table.getState().columnFilters,
                                            studies: table
                                                .getSortedRowModel()
                                                .rows.map((r) => r.original.id),
                                        })
                                    );
                                    navigate(
                                        `/projects/${projectId}/extraction/studies/${row.original.id}/edit`
                                    );
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
                            justifyContent: 'flex-start',
                            flexWrap: 'wrap',
                            marginRight: '1rem',
                        }}
                    >
                        {columnFilters
                            .filter((filter) => !!filter.value)
                            .map((filter) => (
                                <Chip
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
                        <Typography>
                            Viewing {table.getFilteredRowModel().rows.length} / {data.length}
                        </Typography>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};

export default ExtractionTable;
