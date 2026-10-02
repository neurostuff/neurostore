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
import 'pages/Curation/hooks/useCuratorTableState.tableMeta';
import useGetAllAIExtractedDataForStudies, {
    EAIExtractors,
    IParticipantDemographicExtractor,
    ITaskExtractor,
} from 'hooks/extractions/useGetAllExtractedDataForStudies';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    retrieveCurationTableState,
    updateCurationTableState,
} from 'pages/Curation/components/CurationBoardAIInterfaceCuratorTable.helpers';
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
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [hasLoadedSavedColumns, setHasLoadedSavedColumns] = useState(false);
    const stubsWithNeurostoreIds = useMemo(() => {
        return (allStubs.filter((stub) => !!stub.neurostoreId).map((stub) => stub!.neurostoreId) as string[]).sort();
    }, [allStubs]);
    const { data: extractedData, isLoading } = useGetAllAIExtractedDataForStudies(stubsWithNeurostoreIds);

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
            const stateSelectedColumns = [...state.selectedColumns];
            if (allowAIColumns) {
                ['fMRITasks.TaskName', 'group_name', 'diagnosis'].forEach((column) => {
                    newColumns.push(createColumn(column));
                    stateSelectedColumns.push(column);
                });
            } else {
                ['articleYear', 'title', 'journal', 'authors', 'pmid', 'doi'].forEach((column) => {
                    newColumns.push(createColumn(column));
                    stateSelectedColumns.push(column);
                });
            }
            state.selectedColumns = stateSelectedColumns;
        } else {
            COMBINED_CURATOR_TABLE_COLUMNS.forEach((column) => {
                if (state.selectedColumns.includes(column.id)) newColumns.push(createColumn(column.id));
            });
        }

        setColumns(newColumns);
        setSorting(state.sorting);
        setColumnFilters(state.columnFilters);
        setHasLoadedSavedColumns(true);

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
                    (IParticipantDemographicExtractor & { dateExecuted?: string }) | null;
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
            .filter((column) => (allowAIColumns ? column : !column.meta?.curatorTableColumnAIExtractor));
    }, [allowAIColumns, columns]);

    const table = useReactTable({
        data: data,
        columns: orderedFilteredColumns,
        getCoreRowModel: getCoreRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onRowSelectionChange: setRowSelection,
        enableRowSelection: (row) => row.original.exclusionTag === null,
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
        // columns starts empty. Saving that list before the localStorage read is applied
        // replaces the saved selection. Dev Strict Mode mounts twice, so the second read
        // then loads the empty list. Production builds do not double-mount, which is why
        // these tests pass in GitHub Actions.
        if (!hasLoadedSavedColumns || !projectId) return;

        updateCurationTableState(
            projectId,
            {
                selectedColumns: columns
                    .filter((col) => col.id !== undefined && col.id !== 'select' && col.id !== 'summary')
                    .map((col) => col.id as string),
            },
            allowAIColumns ? '' : 'identification'
        );
    }, [allowAIColumns, columns, hasLoadedSavedColumns, projectId]);

    return {
        table,
        isLoading: isLoading || !hasLoadedSavedColumns,
    };
};

export default useCuratorTableState;
