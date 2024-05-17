import {
    Typography,
    ToggleButtonGroup,
    ToggleButton,
    FormControl,
    RadioGroup,
    FormControlLabel,
    Radio,
    Button,
    Box,
} from '@mui/material';
import CurationImportBaseStyles from 'components/CurationComponents/CurationImport/CurationImportBase.styles';
import { IAlgorithmSelection } from 'components/Dialogs/CreateMetaAnalysisSpecificationDialog/CreateMetaAnalysisSpecificationDialogBase.types';
import {
    getDefaultValuesForTypeAndParameter,
    metaAnalyticAlgorithms,
} from 'components/Dialogs/CreateMetaAnalysisSpecificationDialog/CreateMetaAnalysisSpecificationDialogConstants';
import { IAutocompleteObject } from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';
import { EAnalysisType } from 'hooks/metaAnalyses/useCreateAlgorithmSpecification';
import { useMemo, useState } from 'react';

function SleuthImportWizardCreateMetaAnalysesDetails({
    onNext,
}: {
    onNext: (selectedAlgorithm: IAlgorithmSelection | null) => void;
}) {
    const [shouldCreateMetaAnalyses, setCreateMetaAnalyses] = useState<boolean>();
    const [selectedMetaAnalysisAlgorithm, setSelectedMetaAnalysisAlgorithm] =
        useState<IAlgorithmSelection>({
            estimator: null,
            corrector: null,
            estimatorArgs: {},
            correctorArgs: {},
        });

    const nextButtonDisabled = useMemo(() => {
        if (shouldCreateMetaAnalyses === undefined || shouldCreateMetaAnalyses === null) {
            return true;
        } else if (shouldCreateMetaAnalyses === false) {
            return false;
        } else {
            return !selectedMetaAnalysisAlgorithm.estimator;
        }
    }, [selectedMetaAnalysisAlgorithm, shouldCreateMetaAnalyses]);

    const algorithmOptions = useMemo(() => {
        // later, we may want to add more basic options. For now, just these two
        return metaAnalyticAlgorithms.filter((x) => x.label === 'MKDADensity' || x.label === 'ALE');
    }, []);

    const handleNext = () => {};

    return (
        <Box>
            <Typography gutterBottom variant="h6">
                Would you like to create a meta-analysis for each file you've uploaded?
            </Typography>
            <Box>
                <ToggleButtonGroup
                    sx={{ width: '300px' }}
                    fullWidth
                    size="small"
                    color="primary"
                    value={shouldCreateMetaAnalyses}
                    exclusive
                    onChange={(e, value) => {
                        setCreateMetaAnalyses(value);
                        if (!value) {
                            return setSelectedMetaAnalysisAlgorithm({
                                estimator: null,
                                corrector: null,
                                estimatorArgs: {},
                                correctorArgs: {},
                            });
                        }
                    }}
                    aria-label="Platform"
                >
                    <ToggleButton value={true}>Yes</ToggleButton>
                    <ToggleButton value={false}>No</ToggleButton>
                </ToggleButtonGroup>
            </Box>
            <br />
            {shouldCreateMetaAnalyses && (
                <Box>
                    <Typography variant="h6">Which algorithm would you like to use?</Typography>
                    <Typography gutterBottom color="muted.main">
                        This option can always be changed later. If you are unsure, we suggest
                        starting with MKDA as a default
                    </Typography>
                    <FormControl>
                        <RadioGroup
                            onChange={(e) => {
                                const value = e.target.value;
                                const correspondingOption = algorithmOptions.find(
                                    (x) => x.label === value
                                );
                                setSelectedMetaAnalysisAlgorithm({
                                    estimator: correspondingOption as IAutocompleteObject,
                                    estimatorArgs: getDefaultValuesForTypeAndParameter(
                                        EAnalysisType.CBMA,
                                        value
                                    ),
                                    corrector: null,
                                    correctorArgs: {},
                                });
                            }}
                            value={selectedMetaAnalysisAlgorithm?.estimator?.label || null}
                        >
                            {algorithmOptions.map((algorithmOption) => (
                                <FormControlLabel
                                    sx={{ marginBottom: '1rem' }}
                                    value={algorithmOption.label}
                                    control={<Radio />}
                                    key={algorithmOption.label}
                                    label={
                                        <Box>
                                            <Typography>{algorithmOption.label}</Typography>
                                            <Typography variant="body2">
                                                {algorithmOption.description}
                                            </Typography>
                                        </Box>
                                    }
                                />
                            ))}
                        </RadioGroup>
                    </FormControl>
                </Box>
            )}
            {/* <Box></Box>
                    2. Choose an algorithm for your meta-analysis. You can always change this later.
                    <br />
                    3. We've created a meta-analysis for each file you've uploaded using the MKDA/ALE
                    algorithm. To read more about this, click here. */}
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
                        disabled={nextButtonDisabled}
                        onClick={handleNext}
                    >
                        {shouldCreateMetaAnalyses ? 'create' : 'finish'}
                    </Button>
                </Box>
            </Box>
        </Box>
    );
}

export default SleuthImportWizardCreateMetaAnalysesDetails;
