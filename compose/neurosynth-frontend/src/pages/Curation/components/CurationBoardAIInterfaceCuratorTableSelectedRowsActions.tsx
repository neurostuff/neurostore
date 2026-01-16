import { Box, Button } from '@mui/material';
import { Table } from '@tanstack/react-table';
import { indexToPRISMAMapping, ITag } from 'hooks/projects/useGetProjects';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import {
    useCreateNewExclusion,
    useDemoteStub,
    useProjectCurationPrismaConfig,
    usePromoteStub,
    useSetExclusionForStub,
} from 'pages/Project/store/ProjectStore';
import { useState } from 'react';
import { v4 as uuid } from 'uuid';
import { ICurationTableStudy } from '../hooks/useCuratorTableState.types';
import CurationPopupExclusionSelector from './CurationPopupExclusionSelector';
import { ArrowCircleLeftOutlined } from '@mui/icons-material';
import { useAuth0 } from '@auth0/auth0-react';
import { useUserCanEdit } from 'hooks';

const CurationBoardAIInterfaceCuratorTableSelectedRowsActions: React.FC<{
    table: Table<ICurationTableStudy>;
    columnIndex: number;
}> = ({ table, columnIndex }) => {
    const [exclusionTagSelectorIsOpen, setExclusionTagSelectorIsOpen] = useState(false);
    const rows = table.getSelectedRowModel().rows;
    const createExclusion = useCreateNewExclusion();
    const setExclusionForStub = useSetExclusionForStub();
    const prismaConfig = useProjectCurationPrismaConfig();
    const prismaPhase = prismaConfig.isPrisma ? indexToPRISMAMapping(columnIndex) : undefined;
    const demoteStudy = useDemoteStub();
    const promoteStudy = usePromoteStub();
    const { user } = useAuth0();
    const canEdit = useUserCanEdit(user?.sub || undefined);

    const handleAddExclusionForRows = (exclusionTag: ITag) => {
        rows.forEach((stub) => {
            setExclusionForStub(columnIndex, stub.id, exclusionTag.id);
        });
        table.resetRowSelection();
    };

    const handleCreateExclusion = (exclusionName: string) => {
        const newExclusion = {
            id: uuid(),
            label: exclusionName,
            isExclusionTag: true,
            isAssignable: true,
        };

        createExclusion(newExclusion, prismaPhase);
        handleAddExclusionForRows(newExclusion);
    };

    const handleDemoteStudies = () => {
        rows.forEach((stub) => {
            demoteStudy(columnIndex, stub.id);
        });
        table.resetRowSelection();
    };

    const handlePromoteStudies = () => {
        rows.forEach((stub) => {
            promoteStudy(columnIndex, stub.id);
        });
        table.resetRowSelection();
    };

    const numRowsSelected = table.getSelectedRowModel().rows.length;
    const isPrismaIdentificationPhase = prismaConfig.isPrisma && prismaPhase === 'identification';
    const isStepBeforeInclude = prismaPhase === 'eligibility' || (!prismaConfig.isPrisma && columnIndex === 0);

    return (
        <Box sx={{ marginRight: '8px', display: 'flex' }}>
            <Button
                color="success"
                size="small"
                style={{ marginRight: '8px', fontSize: '12px' }}
                variant="outlined"
                disabled={!canEdit}
                startIcon={<CheckCircleOutlineIcon />}
                onClick={handlePromoteStudies}
            >
                {isStepBeforeInclude ? 'Include' : 'Promote'} ({numRowsSelected})
            </Button>
            <CurationPopupExclusionSelector
                popupIsOpen={exclusionTagSelectorIsOpen}
                onOpenPopup={() => setExclusionTagSelectorIsOpen(true)}
                onClosePopup={() => setExclusionTagSelectorIsOpen(false)}
                onAddExclusion={handleAddExclusionForRows}
                onCreateExclusion={handleCreateExclusion}
                exclusionButtonEndText={` (${numRowsSelected})`}
                disabled={!canEdit}
                prismaPhase={prismaPhase}
                onlyShowDefaultExclusion={isPrismaIdentificationPhase}
            />
            {columnIndex !== 0 && (
                <Button
                    style={{ marginLeft: '8px', fontSize: '12px' }}
                    startIcon={<ArrowCircleLeftOutlined />}
                    variant="outlined"
                    color="secondary"
                    size="small"
                    onClick={handleDemoteStudies}
                    disabled={!canEdit}
                >
                    Demote ({numRowsSelected})
                </Button>
            )}
        </Box>
    );
};

export default CurationBoardAIInterfaceCuratorTableSelectedRowsActions;
