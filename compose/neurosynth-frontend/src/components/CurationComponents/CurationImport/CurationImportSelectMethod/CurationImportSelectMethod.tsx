import { Box, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import NavigationButtons, {
    ENavigationButton,
} from 'components/Buttons/NavigationButtons/NavigationButtons';
import { EImportMode } from '../CurationImport/CurationImport';

const CurationImportSelectMethod: React.FC<{
    importMethod: EImportMode;
    onChangeImportMode: (newImportMode: EImportMode) => void;
    onNavigate: (button: ENavigationButton) => void;
}> = (props) => {
    return (
        <Box sx={{ marginTop: '2rem' }}>
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <FormControl sx={{ width: '600px' }}>
                    <InputLabel id="num-col-label">Import Method</InputLabel>
                    <Select
                        label="Import Method"
                        value={props.importMethod}
                        onChange={(event) => {
                            props.onChangeImportMode(event.target.value as EImportMode);
                        }}
                    >
                        <MenuItem value={EImportMode.NEUROSTORE_IMPORT}>
                            Import via Neurostore
                        </MenuItem>
                        <MenuItem value={EImportMode.PUBMED_IMPORT}>
                            Import via Pubmed ID (PMID) List
                        </MenuItem>
                        <MenuItem value={EImportMode.MANUAL_CREATE}>
                            Manually Create a New Study
                        </MenuItem>
                        <MenuItem value={EImportMode.FILE_IMPORT}>
                            Import via File Format (RIS, endnote, and BibTex)
                        </MenuItem>
                    </Select>
                </FormControl>
            </Box>
            <Box sx={{ marginTop: '2rem' }}>
                <NavigationButtons prevButtonDisabled onButtonClick={props.onNavigate} />
            </Box>
        </Box>
    );
};

export default CurationImportSelectMethod;
