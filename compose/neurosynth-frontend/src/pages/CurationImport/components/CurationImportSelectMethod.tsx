import { Box, Button, FormControl, FormControlLabel, Radio, RadioGroup, Typography } from '@mui/material';
import { ENavigationButton } from 'components/Buttons/NavigationButtons';
import CurationImportSelectMethodStyles from 'pages/CurationImport/components/CurationImportSelectMethod.styles';
import CurationImportStyles from 'pages/CurationImport/components/CurationImport.styles';
import { EImportMode } from 'pages/CurationImport/CurationImport.types';

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
                    sx={CurationImportSelectMethodStyles.radioGroup}
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
                                <Typography variant="h6">Search Neurostore</Typography>
                                <Typography variant="body1" sx={{ color: 'muted.main' }}>
                                    Search our database of over 30,000 neuroimaging studies with automatically extracted
                                    coordinates
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
                                <Typography variant="h6">Import via Pubmed ID (PMID) List</Typography>
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
                            props.importMethod === EImportMode.SLEUTH_IMPORT
                                ? CurationImportSelectMethodStyles.selected
                                : { border: '2px solid transparent' },
                        ]}
                        value={EImportMode.SLEUTH_IMPORT}
                        label={
                            <>
                                <Typography variant="h6">Import Sleuth File</Typography>
                                <Typography variant="body1" sx={{ color: 'muted.main' }}>
                                    Import studies from a sleuth file into your project
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
                                <Typography variant="h6">Import Bibliography</Typography>
                                <Typography variant="body1" sx={{ color: 'muted.main' }}>
                                    Import studies from standard bibliographic formats such as RIS, EndNote, or BibTeX
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
                                    Create a new study from scratch, manually filling in the title, authors, PMID, DOI,
                                    etc
                                </Typography>
                            </>
                        }
                        control={<Radio />}
                    />
                </RadioGroup>
            </FormControl>

            <Box sx={CurationImportStyles.fixedContainer}>
                <Box sx={[CurationImportStyles.fixedButtonsContainer, { justifyContent: 'flex-end' }]}>
                    <Button
                        variant="contained"
                        sx={CurationImportStyles.nextButton}
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
