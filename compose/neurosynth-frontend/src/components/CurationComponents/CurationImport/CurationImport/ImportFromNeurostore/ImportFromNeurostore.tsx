import { Box } from '@mui/material';
import { IImportArgs } from '../CurationImport';
import NeurostoreSearch from './NeurostoreSearch';

const BaseImportFromNeurostore: React.FC<IImportArgs> = (props) => {
    return (
        <Box sx={{ marginTop: '1rem' }}>
            <NeurostoreSearch {...props} />
        </Box>
    );
};

export default BaseImportFromNeurostore;
