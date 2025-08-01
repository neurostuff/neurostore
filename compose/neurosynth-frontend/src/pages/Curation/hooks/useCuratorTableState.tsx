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
import { COMBINED_CURATOR_TABLE_COLUMNS, createColumn } from './useCuratorTableState.helpers';
import { ICurationTableColumnType, ICurationTableStudy } from './useCuratorTableState.types';

const useCuratorTableState = (
    projectId: string | undefined,
    allStubs: ICurationStubStudy[],
    allowRowSelection: boolean,
    allowAIColumns: boolean
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
        const state = retrieveCurationTableState(projectId, allowAIColumns ? '' : 'identification');
        if (!state) return;

        const newColumns: (
            | DisplayColumnDef<ICurationTableStudy, ICurationTableColumnType>
            | AccessorFnColumnDef<ICurationTableStudy, ICurationTableColumnType>
        )[] = [];

        if (allowRowSelection) newColumns.push(createColumn('select'));
        if (allowAIColumns) newColumns.push(createColumn('summary'));

        if (state.firstTimeSeeingPage) {
            // set defaults
            if (allowAIColumns) {
                newColumns.push(createColumn('fMRITasks.TaskName'));
                newColumns.push(createColumn('group_name'));
                newColumns.push(createColumn('diagnosis'));
            } else {
                newColumns.push(createColumn('articleYear'));
                newColumns.push(createColumn('title'));
                newColumns.push(createColumn('journal'));
                newColumns.push(createColumn('authors'));
                newColumns.push(createColumn('pmid'));
                newColumns.push(createColumn('doi'));
            }
        } else {
            COMBINED_CURATOR_TABLE_COLUMNS.forEach((column) => {
                if (state.selectedColumns.includes(column.id)) newColumns.push(createColumn(column.id));
            });
        }

        setColumns(newColumns);
        setSorting(state.sorting);
        setColumnFilters(state.columnFilters);

        updateCurationTableState(
            projectId,
            {
                firstTimeSeeingPage: false,
                selectedColumns: state.selectedColumns,
            },
            allowAIColumns ? '' : 'identification'
        );
    }, [projectId, allowRowSelection, allowAIColumns]);

    const handleAddColumn = useCallback((colId: string) => {
        setColumns((prev) => {
            const newColumn = createColumn(colId);
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
        if (!allStubs) return [];

        const extractedDataMap = new Map<
            string, // base study id
            {
                taskExtraction: (ITaskExtractor & { dateExecuted?: string }) | null;
                participantDemographicsExtraction:
                    | (IParticipantDemographicExtractor & { dateExecuted?: string })
                    | null;
            }
        >();

        if (extractedData) {
            extractedData[EAIExtractors.TASKEXTRACTOR]?.results.forEach((result) => {
                const existing = extractedDataMap.get(result.base_study_id);
                if (existing && existing.taskExtraction) {
                    // multiple taskExtractions have been done on the same base study, we want to grab the latest one
                    const existingResultDate = new Date(existing.taskExtraction.dateExecuted as string);
                    const resultDate = new Date(result.date_executed as string);

                    if (resultDate > existingResultDate) {
                        extractedDataMap.set(result.base_study_id, {
                            taskExtraction: {
                                ...(result.result_data as ITaskExtractor),
                                dateExecuted: result.date_executed,
                            },
                            participantDemographicsExtraction: existing.participantDemographicsExtraction,
                        });
                        return;
                    }
                } else {
                    extractedDataMap.set(result.base_study_id, {
                        taskExtraction: {
                            ...(result.result_data as ITaskExtractor),
                            dateExecuted: result.date_executed,
                        },
                        participantDemographicsExtraction: null,
                    });
                }
            });

            extractedData[EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]?.results.forEach((result) => {
                const existing = extractedDataMap.get(result.base_study_id);

                if (existing && existing.participantDemographicsExtraction) {
                    // multiple participant demographics extractions have been done on the same base study, we want to grab the latest one
                    const existingResultDate = new Date(
                        existing.participantDemographicsExtraction.dateExecuted as string
                    );
                    const resultDate = new Date(result.date_executed as string);

                    if (resultDate > existingResultDate) {
                        extractedDataMap.set(result.base_study_id, {
                            taskExtraction: existing.taskExtraction,
                            participantDemographicsExtraction: {
                                ...(result.result_data as IParticipantDemographicExtractor),
                                dateExecuted: result.date_executed,
                            },
                        });
                        return;
                    }
                } else {
                    extractedDataMap.set(result.base_study_id, {
                        taskExtraction: existing ? existing.taskExtraction : null,
                        participantDemographicsExtraction: {
                            ...(result.result_data as IParticipantDemographicExtractor),
                            dateExecuted: result.date_executed,
                        },
                    });
                }
            });
        }

        return allStubs.map((stub) => {
            const extractedData = extractedDataMap.get(stub.neurostoreId || '');
            delete extractedData?.taskExtraction?.dateExecuted;
            delete extractedData?.participantDemographicsExtraction?.dateExecuted;

            return {
                ...stub,
                [EAIExtractors.TASKEXTRACTOR]: extractedData?.taskExtraction || null,
                [EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]:
                    extractedData?.participantDemographicsExtraction || null,
            };
        });
    }, [allStubs, extractedData]);

    const orderedFilteredColumns = useMemo(() => {
        return columns
            .sort((colA, colB) => {
                const indexA = COMBINED_CURATOR_TABLE_COLUMNS.findIndex((col) => col.id === colA.id);
                const indexB = COMBINED_CURATOR_TABLE_COLUMNS.findIndex((col) => col.id === colB.id);
                return indexA - indexB;
            })
            .filter((column) => (allowAIColumns ? column : !column.meta?.AIExtractor));
    }, [allowAIColumns, columns]);

    const table = useReactTable({
        data: data,
        columns: orderedFilteredColumns,
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
        updateCurationTableState(
            projectId,
            {
                columnFilters: columnFilters,
            },
            allowAIColumns ? '' : 'identification'
        );
    }, [allowAIColumns, columnFilters, projectId]);
    useEffect(() => {
        updateCurationTableState(
            projectId,
            {
                sorting: sorting,
            },
            allowAIColumns ? '' : 'identification'
        );
    }, [sorting, projectId, allowAIColumns]);
    useEffect(() => {
        updateCurationTableState(
            projectId,
            {
                selectedColumns: columns
                    .filter((col) => col.id !== undefined && col.id !== 'select' && col.id !== 'summary')
                    .map((col) => col.id as string),
            },
            allowAIColumns ? '' : 'identification'
        );
    }, [allowAIColumns, columns, projectId]);

    return table;
};

export default useCuratorTableState;
