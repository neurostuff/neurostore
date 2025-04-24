import {
    AccessorFnColumnDef,
    ColumnFiltersState,
    createColumnHelper,
    DisplayColumnDef,
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    RowSelectionState,
    SortingColumnDef,
    SortingState,
    useReactTable,
} from '@tanstack/react-table';
import useGetAllAIExtractedData, {
    EAIExtractors,
    IParticipantDemographicExtractor,
    ITaskExtractor,
} from 'hooks/extractions/useGetAllExtractedData';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    retrieveCurationTableState,
    updateCurationTableState,
} from '../components/CurationBoardAIInterfaceCuratorTable.helpers';
import CuratorTableCell from '../components/CurationBoardAIInterfaceCuratorTableCell';
import { CuratorTableHeader } from '../components/CurationBoardAIInterfaceCuratorTableHeader';
import {
    CuratorTableSelectCell,
    CuratorTableSelectHeader,
} from '../components/CurationBoardAIInterfaceCuratorTableSelect';
import {
    CuratorTableSummaryCell,
    CuratorTableSummaryHeader,
} from '../components/CurationBoardAIInterfaceCuratorTableSummary';
import { ICurationStubStudy } from '../Curation.types';

export interface ICurationBoardAIInterfaceCuratorTableType {
    id: string;
    isAIExtracted: boolean;
    label: string;
    filterVariant: undefined | 'text' | 'numeric';
    canSort: boolean;
    sortingFn?: SortingColumnDef<ICurationTableStudy>['sortingFn'];
    customAccessor?: (stub: ICurationTableStudy) => string;
}

export const AI_INTERFACE_CURATOR_COLUMNS: ICurationBoardAIInterfaceCuratorTableType[] = [
    {
        id: 'articleYear',
        label: 'Year',
        filterVariant: 'numeric',
        canSort: true,
        sortingFn: 'alphanumeric',
        isAIExtracted: false,
    },
    { id: 'title', label: 'Title', filterVariant: 'text', canSort: true, sortingFn: 'text', isAIExtracted: false },
    { id: 'authors', label: 'Authors', filterVariant: 'text', canSort: true, sortingFn: 'text', isAIExtracted: false },
    {
        id: 'keywords',
        label: 'Keywords',
        filterVariant: 'text',
        canSort: true,
        sortingFn: 'text',
        isAIExtracted: false,
    },
    {
        id: 'pmid',
        label: 'PMID',
        filterVariant: 'text',
        canSort: true,
        sortingFn: 'alphanumeric',
        isAIExtracted: false,
    },
    { id: 'doi', label: 'DOI', filterVariant: 'text', canSort: true, sortingFn: 'alphanumeric', isAIExtracted: false },
    { id: 'journal', label: 'Journal', filterVariant: 'text', canSort: true, sortingFn: 'text', isAIExtracted: false },
    {
        id: 'abstractText',
        label: 'Abstract',
        filterVariant: undefined,
        canSort: true,
        sortingFn: 'text',
        isAIExtracted: false,
    },
    {
        id: 'identificationSource',
        label: 'Source',
        filterVariant: 'text',
        canSort: true,
        sortingFn: 'text',
        customAccessor: (stub) => stub.identificationSource.label,
        isAIExtracted: false,
    },
    {
        id: 'numMales',
        label: 'Num Males',
        filterVariant: 'numeric',
        canSort: true,
        sortingFn: 'alphanumeric',
        customAccessor: (stub) => {
            if (stub[EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]) {
                const mlCnt = stub[EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]?.groups[0]?.male_count;
                return mlCnt ? mlCnt.toString() : '';
            }
            return '';
        },
        isAIExtracted: true,
    },
    {
        id: 'studyObjective',
        label: 'Study Objective',
        filterVariant: 'text',
        canSort: false,
        customAccessor: (stub) => {
            if (stub[EAIExtractors.TASKEXTRACTOR]) {
                return stub[EAIExtractors.TASKEXTRACTOR]?.StudyObjective || '';
            }
            return '';
        },
        isAIExtracted: true,
    },
];

export type ICurationTableStudy = ICurationStubStudy & {
    [EAIExtractors.TASKEXTRACTOR]: ITaskExtractor | null;
    [EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]: IParticipantDemographicExtractor | null;
};
const columnHelper = createColumnHelper<ICurationTableStudy>();

const createColumn = (
    columnId: string
): DisplayColumnDef<ICurationTableStudy, unknown> | AccessorFnColumnDef<ICurationTableStudy, string> => {
    if (columnId === 'select') {
        return columnHelper.display({
            id: 'select',
            cell: CuratorTableSelectCell,
            header: CuratorTableSelectHeader,
            size: 40,
        });
    }
    if (columnId === 'summary') {
        return columnHelper.display({
            id: 'summary',
            cell: CuratorTableSummaryCell,
            header: CuratorTableSummaryHeader,
        });
    }

    const foundColumn = AI_INTERFACE_CURATOR_COLUMNS.find((COL) => COL.id === columnId);
    if (!foundColumn) throw new Error('Unrecognized column');
    const newColumn = columnHelper.accessor(
        foundColumn.customAccessor
            ? foundColumn.customAccessor
            : (stub) => stub[foundColumn.id as keyof ICurationTableStudy] as string,
        {
            id: foundColumn.id,
            cell: CuratorTableCell,
            header: CuratorTableHeader,
            enableSorting: foundColumn.canSort,
            enableColumnFilter: foundColumn.filterVariant !== undefined,
            filterFn:
                foundColumn.filterVariant === 'text'
                    ? 'includesString'
                    : foundColumn.filterVariant === 'numeric'
                      ? 'inNumberRange'
                      : undefined,
            size: foundColumn.id === 'abstractText' ? 400 : 180,
            sortingFn: foundColumn.sortingFn,
            meta: {
                columnLabel: foundColumn.label,
                isAIExtracted: foundColumn.isAIExtracted,
                filterVariant: foundColumn.filterVariant,
            },
        }
    );
    return newColumn;
};

const useCuratorTableState = (
    projectId: string | undefined,
    allStubs: ICurationStubStudy[],
    allowRowSelection: boolean
) => {
    const [columns, setColumns] = useState<
        (DisplayColumnDef<ICurationTableStudy, unknown> | AccessorFnColumnDef<ICurationTableStudy, string>)[]
    >([]);
    const [sorting, setSorting] = useState<SortingState>([]);
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const { data: extractedData } = useGetAllAIExtractedData();

    console.log({ extractedData });

    useEffect(() => {
        if (!projectId) return;
        const state = retrieveCurationTableState(projectId);
        if (!state) return;

        setColumns(() => {
            const newColumns = [];
            if (allowRowSelection) {
                newColumns.push(createColumn('select'));
            }
            newColumns.push(createColumn('summary'));
            state.selectedColumns.forEach((column) => newColumns.push(createColumn(column)));
            return newColumns;
        });
        setSorting(state.sorting);
        setColumnFilters(state.columnFilters);
    }, [projectId, allowRowSelection]);

    const handleAddColumn = useCallback((column: string) => {
        setColumns((prev) => {
            const newColumn = createColumn(column);
            if (!newColumn) return prev;

            return [...prev, newColumn];
        });
    }, []);

    const handleRemoveColumn = useCallback((column: string) => {
        setColumns((prev) => {
            return prev.filter((col) => col.id !== column);
        });
        setSorting((prev) => {
            return prev.filter((col) => col.id !== column);
        });
        setColumnFilters((prev) => {
            return prev.filter((col) => col.id !== column);
        });
    }, []);

    const data = useMemo(() => {
        if (!extractedData || !allStubs) return [];

        const extractedDataMap = new Map<
            string,
            {
                taskExtraction: ITaskExtractor | null;
                participantDemographicsExtraction: IParticipantDemographicExtractor | null;
            }
        >();

        extractedData[EAIExtractors.TASKEXTRACTOR]?.results.forEach((result) => {
            extractedDataMap.set(result.base_study_id, {
                taskExtraction: result.result_data as ITaskExtractor,
                participantDemographicsExtraction: null,
            });
        });

        extractedData[EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]?.results.forEach((result) => {
            const existing = extractedDataMap.get(result.base_study_id);
            if (existing) {
                extractedDataMap.set(result.base_study_id, {
                    taskExtraction: existing.taskExtraction,
                    participantDemographicsExtraction: result.result_data as IParticipantDemographicExtractor,
                });
            } else {
                extractedDataMap.set(result.base_study_id, {
                    taskExtraction: null,
                    participantDemographicsExtraction: result.result_data as IParticipantDemographicExtractor,
                });
            }
        });

        return allStubs.map((stub) => {
            if (stub.neurostoreId) {
                const extractedData = extractedDataMap.get(stub.neurostoreId);
                return {
                    ...stub,
                    [EAIExtractors.TASKEXTRACTOR]: extractedData?.taskExtraction || null,
                    [EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]:
                        extractedData?.participantDemographicsExtraction || null,
                };
            } else {
                return {
                    ...stub,
                    [EAIExtractors.TASKEXTRACTOR]: null,
                    [EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]: null,
                };
            }
        });
    }, [allStubs, extractedData]);

    const table = useReactTable({
        data: data,
        columns: columns,
        getCoreRowModel: getCoreRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onRowSelectionChange: setRowSelection,
        enableRowSelection: true,
        enableMultiRowSelection: true,
        enableSubRowSelection: false,
        getRowId: (stub) => stub.id,
        getFilteredRowModel: getFilteredRowModel(),
        onColumnFiltersChange: setColumnFilters,
        state: {
            columnFilters: columnFilters,
            sorting: sorting,
            rowSelection: rowSelection,
        },
        meta: {
            curatorTableOnAddColumn: handleAddColumn,
            curatorTableOnRemoveColumn: handleRemoveColumn,
        },
    });

    useEffect(() => {
        updateCurationTableState(projectId, {
            columnFilters: columnFilters,
        });
    }, [columnFilters, projectId]);
    useEffect(() => {
        updateCurationTableState(projectId, {
            sorting: sorting,
        });
    }, [sorting, projectId]);
    useEffect(() => {
        updateCurationTableState(projectId, {
            selectedColumns: columns
                .filter((col) => col.id !== undefined && col.id !== 'select' && col.id !== 'summary')
                .map((col) => col.id as string),
        });
    }, [columns, projectId]);

    return table;
};

export default useCuratorTableState;
