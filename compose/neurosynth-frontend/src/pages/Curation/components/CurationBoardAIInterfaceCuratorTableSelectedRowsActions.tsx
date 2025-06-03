import { Box, Button } from '@mui/material';
import { Table } from '@tanstack/react-table';
import { indexToPRISMAMapping, ITag } from 'hooks/projects/useGetProjects';
import {
    useCreateNewExclusion,
    useDemoteStub,
    useProjectCurationPrismaConfig,
    useSetExclusionForStub,
} from 'pages/Project/store/ProjectStore';
import { useState } from 'react';
import { v4 as uuid } from 'uuid';
import { ICurationTableStudy } from '../hooks/useCuratorTableState.types';
import CurationPopupExclusionSelector from './CurationPopupExclusionSelector';
import { ArrowCircleLeftOutlined } from '@mui/icons-material';

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
    const demoteStudies = useDemoteStub();

    const handleAddExclusionForRows = (exclusionTag: ITag) => {
        rows.forEach((stub) => {
            setExclusionForStub(columnIndex, stub.id, exclusionTag);
        });
        table.setRowSelection({});
    };

    const handleCreateExclusion = (exclusionName: string) => {
        const newExclusion = {
            id: uuid(),
            label: exclusionName,
            isExclusionTag: true,
            isAssignable: true,
        };

        createExclusion(newExclusion, undefined);
        handleAddExclusionForRows(newExclusion);
    };

    const handleDemoteStudies = () => {
        rows.forEach((stub) => {
            demoteStudies(columnIndex, stub.id);
        });
        table.setRowSelection({});
    };

    const numRowsSelected = table.getSelectedRowModel().rows.length;
    const isPrismaIdentificationPhase = prismaConfig.isPrisma && prismaPhase === 'identification';

    return (
        <Box sx={{ marginRight: '8px', display: 'flex' }}>
            <CurationPopupExclusionSelector
                popupIsOpen={exclusionTagSelectorIsOpen}
                onOpenPopup={() => setExclusionTagSelectorIsOpen(true)}
                onClosePopup={() => setExclusionTagSelectorIsOpen(false)}
                onAddExclusion={handleAddExclusionForRows}
                onCreateExclusion={handleCreateExclusion}
                exclusionButtonEndText={` (${numRowsSelected})`}
                disabled={false}
                prismaPhase={prismaPhase}
                onlyShowDefaultExclusion={isPrismaIdentificationPhase}
            />
            {columnIndex !== 0 && (
                <Button
                    style={{ marginLeft: '8px' }}
                    startIcon={<ArrowCircleLeftOutlined />}
                    variant="outlined"
                    color="secondary"
                    size="small"
                    onClick={handleDemoteStudies}
                >
                    Move back ({numRowsSelected})
                </Button>
            )}
        </Box>
    );
};

export default CurationBoardAIInterfaceCuratorTableSelectedRowsActions;
