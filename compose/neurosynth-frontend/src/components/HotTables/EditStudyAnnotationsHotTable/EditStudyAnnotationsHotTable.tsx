import { HotTable } from '@handsontable/react';
import { Box } from '@mui/material';
import { HotSettings } from './EditStudyAnnotationsHotTable.helpers';

const EditStudyAnnotationsHotTable: React.FC = (props) => {
    // calculate table height

    return (
        <Box>
            <HotTable {...HotSettings} />
        </Box>
    );
};

export default EditStudyAnnotationsHotTable;
