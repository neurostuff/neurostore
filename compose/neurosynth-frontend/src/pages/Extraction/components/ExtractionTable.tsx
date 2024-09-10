import {
    Box,
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
import { StudyReturn } from 'neurostore-typescript-sdk';
import {
    useProjectExtractionStudysetId,
    useProjectExtractionStudyStatusList,
} from 'pages/Project/store/ProjectStore';
import { ChangeEvent, useCallback, useMemo, useState } from 'react';
import { ExtractionTableAuthorCell, ExtractionTableAuthorHeader } from './ExtractionTableAuthor';
import { ExtractionTableDOICell, ExtractionTableDOIHeader } from './ExtractionTableDOI';
import ExtractionTableFilterInput from './ExtractionTableFilterInput';
import { ExtractionTableJournalCell, ExtractionTableJournalHeader } from './ExtractionTableJournal';
import { ExtractionTableNameCell, ExtractionTableNameHeader } from './ExtractionTableName';
import { ExtractionTablePMIDCell, ExtractionTablePMIDHeader } from './ExtractionTablePMID';
import { ExtractionTableStatusCell, ExtractionTableStatusHeader } from './ExtractionTableStatus';
import { ExtractionTableYearCell, ExtractionTableYearHeader } from './ExtractionTableYear';
import { getNumTotalPages } from 'components/Search/SearchContainer';
import { IStudyExtractionStatus } from 'hooks/projects/useGetProjects';
import styles from './ExtractionTable.module.css';

//allows us to define custom properties for our columns
declare module '@tanstack/react-table' {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface ColumnMeta<TData extends RowData, TValue> {
        filterVariant?: 'text' | 'status-select' | 'journal-autocomplete';
    }
}

const columnHelper = createColumnHelper<StudyReturn>();

const ExtractionTable: React.FC = () => {
    const studysetId = useProjectExtractionStudysetId();
    const studyStatusList = useProjectExtractionStudyStatusList();
    const { data: studyset } = useGetStudysetById(studysetId, true); // this should already be loaded in the cache from the parent component

    const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: 25,
    });
    const numTotalPages = useMemo(() => {
        return getNumTotalPages(studyset?.studies?.length || 0, pagination.pageSize);
    }, [pagination.pageSize, studyset?.studies]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [sorting, setSorting] = useState<SortingState>([]);

    const data: Array<StudyReturn> = useMemo(
        () => (studyset?.studies || []) as Array<StudyReturn>,
        [studyset?.studies]
    );

    const studyStatusMap = useMemo(() => {
        const map = new Map<string, IStudyExtractionStatus>();
        studyStatusList?.forEach((studyStatus) => {
            map.set(studyStatus.id, studyStatus);
        });
        return map;
    }, [studyStatusList]);

    const columns = useMemo(() => {
        const columns = [];

        columns.push(
            columnHelper.accessor('year', {
                id: 'year',
                cell: ExtractionTableYearCell,
                header: ExtractionTableYearHeader,
                enableSorting: true,
                enableColumnFilter: false,
            }),
            columnHelper.accessor('name', {
                id: 'name',
                cell: ExtractionTableNameCell,
                // size: 15,
                // minSize: 15,
                // maxSize: 15,
                header: ExtractionTableNameHeader,
                enableSorting: true,
                sortingFn: 'text',
                meta: {
                    filterVariant: 'text',
                },
            }),
            columnHelper.accessor('authors', {
                id: 'authors',
                // size: 20,
                // minSize: 20,
                // maxSize: 20,
                enableSorting: true,
                cell: ExtractionTableAuthorCell,
                header: ExtractionTableAuthorHeader,
                meta: {
                    filterVariant: 'text',
                },
            }),
            columnHelper.accessor('publication', {
                id: 'journal',
                // size: 20,
                // minSize: 20,
                // maxSize: 20,
                enableSorting: true,
                cell: ExtractionTableJournalCell,
                header: ExtractionTableJournalHeader,
                meta: {
                    filterVariant: 'journal-autocomplete',
                },
            }),
            columnHelper.accessor('doi', {
                id: 'doi',
                // size: 10,
                // minSize: 10,
                // maxSize: 10,
                enableSorting: true,
                cell: ExtractionTableDOICell,
                header: ExtractionTableDOIHeader,
                meta: {
                    filterVariant: 'text',
                },
            }),
            columnHelper.accessor('pmid', {
                id: 'pmid',
                // size: 10,
                // minSize: 10,
                // maxSize: 10,
                cell: ExtractionTablePMIDCell,
                header: ExtractionTablePMIDHeader,
                enableSorting: true,
                sortingFn: 'alphanumeric',
                meta: {
                    filterVariant: 'text',
                },
            }),
            columnHelper.accessor(({ id }) => studyStatusMap.get(id || ''), {
                id: 'status',
                // size: 20,
                // minSize: 20,
                // maxSize: 20,
                enableSorting: true,
                cell: ExtractionTableStatusCell,
                header: ExtractionTableStatusHeader,
                enableColumnFilter: true,
                meta: {
                    filterVariant: 'status-select',
                },
            })
        );

        return columns;
    }, [studyStatusMap]);

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
    });

    const handleRowsPerPageChange = useCallback(
        (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {},
        []
    );

    const handlePaginationChange = useCallback(
        (_event: React.MouseEvent | null, page: number) => {},
        []
    );

    return (
        <Box sx={{ marginBottom: '4rem' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Pagination count={numTotalPages} siblingCount={3} boundaryCount={3} />
                <Typography variant="h5">{data.length} studies</Typography>
            </Box>
            <TableContainer sx={{ marginBottom: '2rem' }}>
                <Table size="small">
                    <TableHead>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableCell key={header.id}>
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
                                className={`${
                                    styles[
                                        studyStatusMap.get(row.original.id || '')?.status ??
                                            'uncategorized'
                                    ]
                                }`}
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
                    justifyContent: 'space-between',
                    textAlign: 'center',
                    paddingY: '0.6rem',
                }}
            >
                <Pagination
                    sx={{ display: 'flex', alignItems: 'center' }}
                    count={numTotalPages}
                    siblingCount={2}
                    boundaryCount={2}
                />
                <TablePagination
                    rowsPerPage={pagination.pageSize}
                    onRowsPerPageChange={handleRowsPerPageChange}
                    onPageChange={handlePaginationChange}
                    component="div"
                    rowsPerPageOptions={[10, 25, 50, 100]}
                    page={0}
                    count={data.length}
                />
            </Box>
        </Box>
    );
};

export default ExtractionTable;
