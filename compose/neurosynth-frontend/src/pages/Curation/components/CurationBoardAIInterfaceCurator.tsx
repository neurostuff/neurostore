import { Box, Button, Typography } from '@mui/material';
import { useUserCanEdit } from 'hooks';
import { useProjectCurationColumns, useProjectUser } from 'pages/Project/store/ProjectStore';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ICurationStubStudy } from '../Curation.types';
import { IGroupListItem } from './CurationBoardAIGroupsList';
import CurationBoardAIInterfaceCuratorFocus from './CurationBoardAIInterfaceCuratorFocus';
import CurationBoardAIInterfaceCuratorTable from './CurationBoardAIInterfaceCuratorTable';
import { GridTableRowsIcon } from '@mui/x-data-grid';

export interface ICurationBoardAIInterfaceCurator {
    selectedStub: ICurationStubStudy | undefined;
    stubs: ICurationStubStudy[];
    columnIndex: number;
    onSetSelectedStub: (stubId: string) => void;
}

const CurationBoardAIInterfaceCurator: React.FC<{ group: IGroupListItem }> = ({ group }) => {
    const navigate = useNavigate();
    const { projectId } = useParams<{ projectId: string | undefined }>();

    const [UIMode, setUIMode] = useState<'TABLEMODE' | 'FOCUSMODE'>('TABLEMODE');

    const projectUser = useProjectUser();
    const canEdit = useUserCanEdit(projectUser || undefined);
    const curationColumns = useProjectCurationColumns();

    const [selectedStubId, setSelectedStubId] = useState<string>();

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

    const stubsInColumn = useMemo(() => {
        if (!column) return [];
        return column.stubStudies.filter((x) => x.exclusionTag === null);
    }, [column]);

    const selectedStub: ICurationStubStudy | undefined = useMemo(
        () => (stubsInColumn || []).find((stub) => stub.id === selectedStubId),
        [stubsInColumn, selectedStubId]
    );

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
        if (column === undefined || stubsInColumn.length === 0) return;
        setSelectedStubId(stubsInColumn[0]?.id);
    }, [group.id]);

    if (!column || columnIndex < 0) {
        return <Typography color="error.dark">There was an error loading studies</Typography>;
    }

    return (
        <Box sx={{ height: '100%' }}>
            <Box sx={{ padding: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                <Box>
                    {UIMode === 'FOCUSMODE' && (
                        <Button
                            endIcon={<GridTableRowsIcon />}
                            sx={{ marginRight: '0.5rem' }}
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
                        sx={{ marginRight: '0.5rem', width: '180px' }}
                        onClick={() => navigate(`/projects/${projectId}/curation/import`)}
                        disabled={!canEdit}
                        size="small"
                    >
                        import studies
                    </Button>
                </Box>
            </Box>
            {UIMode === 'TABLEMODE' ? (
                <CurationBoardAIInterfaceCuratorTable
                    selectedStub={selectedStub}
                    columnIndex={columnIndex}
                    stubs={stubsInColumn}
                    onSetSelectedStub={setSelectedStubAndFocus}
                />
            ) : (
                <CurationBoardAIInterfaceCuratorFocus
                    selectedStub={selectedStub}
                    columnIndex={columnIndex}
                    stubs={stubsInColumn}
                    onSetSelectedStub={setSelectedStubId}
                />
            )}
        </Box>
    );
};

export default CurationBoardAIInterfaceCurator;
