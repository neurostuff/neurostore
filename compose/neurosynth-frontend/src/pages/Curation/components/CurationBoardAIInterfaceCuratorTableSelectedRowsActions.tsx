import { Box } from '@mui/material';
import { Table } from '@tanstack/react-table';
import { ITag } from 'hooks/projects/useGetProjects';
import { useCreateNewExclusion, useSetExclusionForStub } from 'pages/Project/store/ProjectStore';
import { useState } from 'react';
import { v4 as uuid } from 'uuid';
import { ICurationStubStudy } from '../Curation.types';
import CurationPopupExclusionSelector from './CurationPopupExclusionSelector';

const CurationBoardAIInterfaceCuratorTableSelectedRowsActions: React.FC<{
    table: Table<ICurationStubStudy>;
    columnIndex: number;
}> = ({ table, columnIndex }) => {
    const [exclusionTagSelectorIsOpen, setExclusionTagSelectorIsOpen] = useState(false);
    const rows = table.getSelectedRowModel().rows;
    const createExclusion = useCreateNewExclusion();
    const setExclusionForStub = useSetExclusionForStub();

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

    return (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <CurationPopupExclusionSelector
                popupIsOpen={exclusionTagSelectorIsOpen}
                onOpenPopup={() => setExclusionTagSelectorIsOpen(true)}
                onClosePopup={() => setExclusionTagSelectorIsOpen(false)}
                onAddExclusion={handleAddExclusionForRows}
                onCreateExclusion={handleCreateExclusion}
                disabled={false}
                prismaPhase={undefined}
            />
        </Box>
    );
};

export default CurationBoardAIInterfaceCuratorTableSelectedRowsActions;
