import { Box, Button, ButtonGroup } from '@mui/material';
import { Table } from '@tanstack/react-table';
import { ICurationStubStudy } from '../Curation.types';
import { CheckCircleOutline, HighlightOffOutlined } from '@mui/icons-material';
import CurationPopupExclusionSelector from './CurationPopupExclusionSelector';
import { useState } from 'react';
import { ITag } from 'hooks/projects/useGetProjects';

const CurationBoardAIInterfaceCuratorTableSelectedRowsActions: React.FC<{ table: Table<ICurationStubStudy> }> = ({
    table,
}) => {
    const [exclusionTagSelectorIsOpen, setExclusionTagSelectorIsOpen] = useState(false);
    const rows = table.getSelectedRowModel().rows;

    const handleAddExclusion = (tag: ITag) => {};

    return (
        <Box>
            <ButtonGroup>
                <Button startIcon={<CheckCircleOutline />} size="small" color="success">
                    Include {rows.length} studies
                </Button>
                <CurationPopupExclusionSelector
                    popupIsOpen={exclusionTagSelectorIsOpen}
                    onOpenPopup={() => setExclusionTagSelectorIsOpen(true)}
                    onClosePopup={() => setExclusionTagSelectorIsOpen(false)}
                    onAddExclusion={handleAddExclusion}
                    onCreateExclusion={handleAddExclusion}
                    columnIndex={props.columnIndex}
                />
                <Button startIcon={<HighlightOffOutlined />} size="small" color="error">
                    Exclude {rows.length} studies
                </Button>
            </ButtonGroup>
        </Box>
    );
};

export default CurationBoardAIInterfaceCuratorTableSelectedRowsActions;
