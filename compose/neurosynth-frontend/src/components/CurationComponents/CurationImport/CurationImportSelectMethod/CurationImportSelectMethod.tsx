import {
    Box,
    Button,
    FormControl,
    FormControlLabel,
    Radio,
    RadioGroup,
    Typography,
} from '@mui/material';
import { ENavigationButton } from 'components/Buttons/NavigationButtons/NavigationButtons';
import { EImportMode } from 'components/CurationComponents/CurationImport/CurationDoImport/CurationDoImport';
import CurationImportSelectMethodStyles from 'components/CurationComponents/CurationImport/CurationImportSelectMethod/CurationImportSelectMethod.styles';
import CurationImportBaseStyles from '../CurationImportBase.styles';

const CurationImportSelectMethod: React.FC<{
    importMethod: EImportMode;
    onChangeImportMode: (newImportMode: EImportMode) => void;
    onNavigate: (button: ENavigationButton) => void;
}> = (props) => {
    return (
        <Box sx={{ margin: '2rem 0 6rem 0' }}>
            <FormControl sx={{ width: '100%' }}>
                <RadioGroup
                    value={props.importMethod}
                    onChange={(event) => {
                        props.onChangeImportMode(event.target.value as EImportMode);
                    }}
                    sx={{
                        '.MuiFormControlLabel-root': {
                            marginLeft: '0 !important',
                            marginRight: '0 !important',
                        },
                    }}
                >
                    <FormControlLabel
                        sx={[
                            CurationImportSelectMethodStyles.radio,
                            props.importMethod === EImportMode.NEUROSTORE_IMPORT
                                ? CurationImportSelectMethodStyles.selected
                                : { border: '2px solid transparent' },
                        ]}
                        value={EImportMode.NEUROSTORE_IMPORT}
                        label={
                            <>
                                <Typography variant="h6">Import via Neurostore</Typography>
                                <Typography variant="body1" sx={{ color: 'muted.main' }}>
                                    Use our database full of automatically extracted coordinates
                                </Typography>
                            </>
                        }
                        control={<Radio />}
                    />
                    <FormControlLabel
                        sx={[
                            CurationImportSelectMethodStyles.radio,
                            props.importMethod === EImportMode.PUBMED_IMPORT
                                ? CurationImportSelectMethodStyles.selected
                                : { border: '2px solid transparent' },
                        ]}
                        value={EImportMode.PUBMED_IMPORT}
                        label={
                            <>
                                <Typography variant="h6">
                                    Import via Pubmed ID (PMID) List
                                </Typography>
                                <Typography variant="body1" sx={{ color: 'muted.main' }}>
                                    Import studies from a collection in pubmed
                                </Typography>
                            </>
                        }
                        control={<Radio />}
                    />
                    <FormControlLabel
                        sx={[
                            CurationImportSelectMethodStyles.radio,
                            props.importMethod === EImportMode.MANUAL_CREATE
                                ? CurationImportSelectMethodStyles.selected
                                : { border: '2px solid transparent' },
                        ]}
                        value={EImportMode.MANUAL_CREATE}
                        label={
                            <>
                                <Typography variant="h6">Manually create a new study</Typography>
                                <Typography variant="body1" sx={{ color: 'muted.main' }}>
                                    Create a new study from scratch, manually filling in the title,
                                    authors, PMID, DOI, etc
                                </Typography>
                            </>
                        }
                        control={<Radio />}
                    />
                    <FormControlLabel
                        sx={[
                            CurationImportSelectMethodStyles.radio,
                            props.importMethod === EImportMode.FILE_IMPORT
                                ? CurationImportSelectMethodStyles.selected
                                : { border: '2px solid transparent' },
                        ]}
                        value={EImportMode.FILE_IMPORT}
                        label={
                            <>
                                <Typography variant="h6">Import via File Format</Typography>
                                <Typography variant="body1" sx={{ color: 'muted.main' }}>
                                    Import studies from widely used standard formats such as RIS,
                                    endnote, or BibTex
                                </Typography>
                            </>
                        }
                        control={<Radio />}
                    />
                </RadioGroup>
            </FormControl>

            <Box sx={CurationImportBaseStyles.fixedContainer}>
                <Box
                    sx={[
                        CurationImportBaseStyles.fixedButtonsContainer,
                        { justifyContent: 'flex-end' },
                    ]}
                >
                    <Button
                        variant="contained"
                        sx={CurationImportBaseStyles.nextButton}
                        disableElevation
                        onClick={() => props.onNavigate(ENavigationButton.NEXT)}
                    >
                        next
                    </Button>
                </Box>
            </Box>
        </Box>
    );
};

export default CurationImportSelectMethod;
