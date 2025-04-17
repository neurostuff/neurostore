import { Box, Button, Typography } from '@mui/material';
import { GridTableRowsIcon } from '@mui/x-data-grid';
import { useUserCanEdit } from 'hooks';
import {
    useProjectCurationColumns,
    useProjectCurationIsLastColumn,
    useProjectUser,
} from 'pages/Project/store/ProjectStore';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ICurationStubStudy } from '../Curation.types';
import { IGroupListItem } from './CurationBoardAIGroupsList';
import CurationBoardAIInterfaceCuratorFocus from './CurationBoardAIInterfaceCuratorFocus';
import CurationBoardAIInterfaceCuratorTable from './CurationBoardAIInterfaceCuratorTable';
import CurationDownloadIncludedStudiesButton from './CurationDownloadIncludedStudiesButton';
import useCuratorTableState from '../hooks/useCuratorTableState';
import { Table } from '@tanstack/react-table';

export interface ICurationBoardAIInterfaceCurator {
    selectedStub: ICurationStubStudy | undefined;
    table: Table<ICurationStubStudy>;
    columnIndex: number;
    onSetSelectedStub: (stubId: string) => void;
}

const CurationBoardAIInterfaceCurator: React.FC<{ group: IGroupListItem }> = ({ group }) => {
    const navigate = useNavigate();
    const { projectId } = useParams<{ projectId: string | undefined }>();
    const curationColumns = useProjectCurationColumns();
    const { column, columnIndex } = useMemo(() => {
        const columnIndex = curationColumns.findIndex((col) => col.id === group.id);
        if (columnIndex < 0)
            return {
                column: undefined,
                columnIndex: -1,
            };
        return {
            column: curationColumns[columnIndex],
            columnIndex: columnIndex,
        };
    }, [curationColumns, group.id]);
    const isLastColumn = useProjectCurationIsLastColumn(columnIndex);
    const stubsInColumn = useMemo(() => {
        if (!column) return [];
        return column.stubStudies.filter((x) => x.exclusionTag === null);
    }, [column]);
    const table = useCuratorTableState(projectId, stubsInColumn, !isLastColumn);

    const [UIMode, setUIMode] = useState<'TABLEMODE' | 'FOCUSMODE'>('TABLEMODE');

    const projectUser = useProjectUser();
    const canEdit = useUserCanEdit(projectUser || undefined);

    const [selectedStubId, setSelectedStubId] = useState<string>();

    const selectedStub: ICurationStubStudy | undefined = useMemo(
        () => (stubsInColumn || []).find((stub) => stub.id === selectedStubId),
        [stubsInColumn, selectedStubId]
    );

    console.log({ selectedStub, columnIndex });

    const handleToggleUIMode = () => {
        setUIMode((prev) => (prev === 'FOCUSMODE' ? 'TABLEMODE' : 'FOCUSMODE'));
    };

    const setSelectedStubAndFocus = useCallback((stubId: string) => {
        setSelectedStubId(stubId);
        setUIMode('FOCUSMODE');
    }, []);

    // we only want the first item to be selected the first time the user clicks on a group.
    // it is safe to only have group.id as a dependency as columns must be loaded by the time we reach here
    useEffect(() => {
        if (stubsInColumn.length === 0) return;
        if (UIMode === 'TABLEMODE') {
            // if tablemode, we want to reset the selected stub as the group id has changed
            setSelectedStubId(undefined);
            return;
        }
        const rows = table.getRowModel().rows;
        if (rows.length === 0) return;
        setSelectedStubId(rows[0].original.id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [group.id]);

    const columnFilters = table.getState().columnFilters;
    const numTotalRows = table.getCoreRowModel().rows.length;

    if (!column || columnIndex < 0) {
        return <Typography color="error.dark">There was an error loading studies</Typography>;
    }

    return (
        <Box sx={{ height: '100%' }}>
            <Box
                sx={{
                    padding: '1rem 2rem 0.5rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <Box sx={{ display: 'flex' }}>
                    <Box>
                        {UIMode === 'FOCUSMODE' && (
                            <Button
                                startIcon={<GridTableRowsIcon />}
                                sx={{ marginRight: '0.5rem', fontSize: '12px' }}
                                size="small"
                                color="secondary"
                                onClick={handleToggleUIMode}
                            >
                                back to table view
                            </Button>
                        )}
                    </Box>
                    <Box>
                        <Button
                            variant="contained"
                            disableElevation
                            sx={{ marginRight: '0.5rem', fontSize: '12px' }}
                            onClick={() => navigate(`/projects/${projectId}/curation/import`)}
                            disabled={!canEdit}
                            size="small"
                        >
                            import studies
                        </Button>
                        {isLastColumn && <CurationDownloadIncludedStudiesButton />}
                    </Box>
                </Box>
                <Box sx={{ whiteSpace: 'nowrap' }}>
                    {columnFilters.length > 0 ? (
                        <Typography sx={{ fontSize: '12px' }}>
                            Viewing {table.getFilteredRowModel().rows.length} / {numTotalRows}
                        </Typography>
                    ) : (
                        <Typography sx={{ fontSize: '12px' }}>Total: {numTotalRows} studies</Typography>
                    )}
                </Box>
            </Box>
            <Box sx={{ height: '100%' }}>
                {UIMode === 'TABLEMODE' ? (
                    <CurationBoardAIInterfaceCuratorTable
                        key={group.id} // reset table state when group is changed
                        columnIndex={columnIndex}
                        selectedStub={selectedStub}
                        table={table}
                        onSetSelectedStub={setSelectedStubAndFocus}
                    />
                ) : (
                    <CurationBoardAIInterfaceCuratorFocus
                        key={group.id}
                        selectedStub={selectedStub}
                        columnIndex={columnIndex}
                        table={table}
                        onSetSelectedStub={setSelectedStubId}
                    />
                )}
            </Box>
        </Box>
    );
};

export default CurationBoardAIInterfaceCurator;
