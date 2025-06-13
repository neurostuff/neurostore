import ChangeHistoryIcon from '@mui/icons-material/ChangeHistory';
import { Box, Button, Typography } from '@mui/material';
import { GridTableRowsIcon } from '@mui/x-data-grid';
import { Row, Table } from '@tanstack/react-table';
import CurationPromoteUncategorizedButton from 'components/Buttons/CurationPromoteUncategorizedButton';
import { useUserCanEdit } from 'hooks';
import useGetAllAIExtractedData from 'hooks/extractions/useGetAllExtractedData';
import { indexToPRISMAMapping } from 'hooks/projects/useGetProjects';
import {
    useProjectCurationColumns,
    useProjectCurationIsLastColumn,
    useProjectCurationPrismaConfig,
    useProjectUser,
} from 'pages/Project/store/ProjectStore';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useCuratorTableState from '../hooks/useCuratorTableState';
import { ICurationTableStudy } from '../hooks/useCuratorTableState.types';
import { IGroupListItem } from './CurationBoardAIGroupsList';
import CurationBoardAIInterfaceCuratorFocus from './CurationBoardAIInterfaceCuratorFocus';
import CurationBoardAIInterfaceCuratorTableSkeleton from './CurationBoardAIInterfaceCuratorSkeleton';
import CurationBoardAIInterfaceCuratorTable from './CurationBoardAIInterfaceCuratorTable';
import CurationDownloadIncludedStudiesButton from './CurationDownloadIncludedStudiesButton';
import PrismaDialog from './PrismaDialog';

export interface ICurationBoardAIInterfaceCurator {
    selectedStub: ICurationTableStudy | undefined;
    table: Table<ICurationTableStudy>;
    columnIndex: number;
    onSetSelectedStub: (stubId: string) => void;
}

const CurationBoardAIInterfaceCurator: React.FC<{ group: IGroupListItem }> = ({ group }) => {
    const navigate = useNavigate();
    const { projectId } = useParams<{ projectId: string | undefined }>();
    const curationColumns = useProjectCurationColumns();
    const { isLoading } = useGetAllAIExtractedData();

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
    const prismaConfig = useProjectCurationPrismaConfig();
    const isPrisma = prismaConfig.isPrisma;
    const prismaPhase = prismaConfig.isPrisma ? indexToPRISMAMapping(columnIndex) : undefined;
    const isLastColumn = useProjectCurationIsLastColumn(columnIndex);
    const stubsInColumn = useMemo(() => {
        if (!column) return [];
        return column.stubStudies.filter((x) => x.exclusionTag === null);
    }, [column]);

    const table = useCuratorTableState(projectId, stubsInColumn, !isLastColumn, prismaPhase !== 'identification');

    const [prismaIsOpen, setPrismaIsOpen] = useState(false);
    const [UIMode, setUIMode] = useState<'TABLEMODE' | 'FOCUSMODE'>('TABLEMODE');

    const projectUser = useProjectUser();
    const canEdit = useUserCanEdit(projectUser || undefined);

    const [selectedStubId, setSelectedStubId] = useState<string>();

    const selectedStub: Row<ICurationTableStudy> | undefined = useMemo(
        () => (table.getCoreRowModel().rows || []).find((stub) => stub.original.id === selectedStubId),
        [table, selectedStubId]
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
        table.resetRowSelection();

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

    if (isLoading) {
        return <CurationBoardAIInterfaceCuratorTableSkeleton />;
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
                        {isPrisma && (
                            <>
                                <PrismaDialog onCloseDialog={() => setPrismaIsOpen(false)} isOpen={prismaIsOpen} />
                                <Button
                                    onClick={() => setPrismaIsOpen(true)}
                                    variant="outlined"
                                    size="small"
                                    style={{ marginRight: '0.5rem', fontSize: '12px' }}
                                    startIcon={<ChangeHistoryIcon />}
                                >
                                    PRISMA diagram
                                </Button>
                            </>
                        )}
                        {columnIndex === 0 && (
                            <CurationPromoteUncategorizedButton
                                dialogTitle={
                                    isPrisma
                                        ? 'Are you sure you want to promote all non duplicated studies in identification to screening?'
                                        : 'Are you sure you want to skip curation?'
                                }
                                sx={{ marginRight: '0.5rem', fontSize: '12px' }}
                                size="small"
                                color="success"
                                variant="outlined"
                            >
                                {isPrisma ? 'Promote Non Duplicated Studies' : 'Skip Curation'}
                            </CurationPromoteUncategorizedButton>
                        )}
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
                        selectedStub={selectedStub?.original}
                        table={table}
                        onSetSelectedStub={setSelectedStubAndFocus}
                    />
                ) : (
                    <CurationBoardAIInterfaceCuratorFocus
                        key={group.id}
                        selectedStub={selectedStub?.original}
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
