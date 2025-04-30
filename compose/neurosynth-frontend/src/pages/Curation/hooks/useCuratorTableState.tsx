import {
    AccessorFnColumnDef,
    ColumnFiltersState,
    DisplayColumnDef,
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    RowSelectionState,
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
import { ICurationStubStudy } from '../Curation.types';
import { createColumn } from './useCuratorTableState.helpers';
import { ICurationTableColumnType, ICurationTableStudy } from './useCuratorTableState.types';

const useCuratorTableState = (
    projectId: string | undefined,
    allStubs: ICurationStubStudy[],
    allowRowSelection: boolean
) => {
    const [columns, setColumns] = useState<
        (
            | DisplayColumnDef<ICurationTableStudy, ICurationTableColumnType>
            | AccessorFnColumnDef<ICurationTableStudy, ICurationTableColumnType>
        )[]
    >([]);
    const [sorting, setSorting] = useState<SortingState>([]);
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const { data: extractedData } = useGetAllAIExtractedData();

    useEffect(() => {
        if (!projectId) return;
        const state = retrieveCurationTableState(projectId);
        if (!state) return;

        setColumns(() => {
            const newColumns: (
                | DisplayColumnDef<ICurationTableStudy, ICurationTableColumnType>
                | AccessorFnColumnDef<ICurationTableStudy, ICurationTableColumnType>
            )[] = [];
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
