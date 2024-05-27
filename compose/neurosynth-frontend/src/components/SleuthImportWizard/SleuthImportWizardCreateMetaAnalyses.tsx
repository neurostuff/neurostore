import { IAlgorithmSelection } from 'components/Dialogs/CreateMetaAnalysisSpecificationDialog/CreateMetaAnalysisSpecificationDialogBase.types';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import useGetProjectById from 'hooks/projects/useGetProjectById';
import { useNavigate } from 'react-router-dom';
import { ISleuthFileUploadStubs } from './SleuthImportWizard.utils';
import { useCreateAlgorithmSpecification } from 'hooks';
import { EAnalysisType } from 'hooks/metaAnalyses/useCreateAlgorithmSpecification';
import {
    Typography,
    ToggleButtonGroup,
    ToggleButton,
    FormControl,
    RadioGroup,
    FormControlLabel,
    Radio,
    Box,
} from '@mui/material';
import CurationImportBaseStyles from 'components/CurationComponents/CurationImport/CurationImportBase.styles';
import {
    getDefaultValuesForTypeAndParameter,
    metaAnalyticAlgorithms,
} from 'components/Dialogs/CreateMetaAnalysisSpecificationDialog/CreateMetaAnalysisSpecificationDialogConstants';
import { IAutocompleteObject } from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';
import { useMemo, useState } from 'react';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import { getWeightAndConditionsForSpecification } from 'components/Dialogs/CreateMetaAnalysisSpecificationDialog/CreateMetaAnalysisSpecificationReview/CreateMetaAnalysisSpecificationReview.helpers';
import { EPropertyType } from 'components/EditMetadata';
import { useSnackbar } from 'notistack';
import { useQueryClient } from 'react-query';

const SleuthImportWizardCreateMetaAnalyses: React.FC<{
    projectId: string;
    studysetId: string;
    annotationId: string;
    sleuthImports: ISleuthFileUploadStubs[];
}> = ({ projectId, studysetId, annotationId, sleuthImports }) => {
    const { isLoading: getProjectIsLoading, isError: getProjectIsError } =
        useGetProjectById(projectId);
    const { isLoading, error, isError, createMetaAnalysis } = useCreateAlgorithmSpecification();
    const [buttonIsLoading, setButtonIsLoading] = useState(false);
    const { enqueueSnackbar } = useSnackbar();
    const navigate = useNavigate();
    const [shouldCreateMetaAnalyses, setShouldCreateMetaAnalyses] = useState<boolean>();
    const queryClient = useQueryClient();
    const [selectedMetaAnalysisAlgorithm, setSelectedMetaAnalysisAlgorithm] =
        useState<IAlgorithmSelection>({
            estimator: null,
            corrector: null,
            estimatorArgs: {},
            correctorArgs: {},
        });

    const handleCreateMetaAnalysisDetails = async () => {
        if (!shouldCreateMetaAnalyses) {
            navigate(`/projects/${projectId}/meta-analyses`);
            return;
        } else {
            setButtonIsLoading(true);
            for (const sleuthImport of sleuthImports) {
                const { weights, conditions, databaseStudyset } =
                    getWeightAndConditionsForSpecification(
                        selectedMetaAnalysisAlgorithm.estimator,
                        {
                            selectionKey: sleuthImport.fileName,
                            type: EPropertyType.BOOLEAN,
                            selectionValue: true,
                            referenceDataset: undefined,
                        }
                    );

                await createMetaAnalysis(
                    projectId,
                    EAnalysisType.CBMA,
                    selectedMetaAnalysisAlgorithm!.estimator,
                    selectedMetaAnalysisAlgorithm!.corrector,
                    studysetId,
                    annotationId,
                    sleuthImport.fileName,
                    `Untitled sleuth project: ${
                        selectedMetaAnalysisAlgorithm!.estimator?.label
                    } Meta Analysis: ${sleuthImport.fileName}`,
                    `${selectedMetaAnalysisAlgorithm!.estimator?.label} Meta Analysis`,
                    selectedMetaAnalysisAlgorithm!.estimatorArgs,
                    selectedMetaAnalysisAlgorithm!.correctorArgs,
                    conditions,
                    weights,
                    databaseStudyset
                );
            }

            await queryClient.invalidateQueries({
                queryKey: ['projects'],
            });

            setButtonIsLoading(false);
            enqueueSnackbar('Meta-analyses created', { variant: 'success' });
            navigate(`/projects/${projectId}/meta-analyses`);
            return;
        }
    };

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

    return (
        <StateHandlerComponent isLoading={getProjectIsLoading} isError={getProjectIsError}>
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
                            setShouldCreateMetaAnalyses(value);
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
                <Box sx={CurationImportBaseStyles.fixedContainer}>
                    <Box
                        sx={[
                            CurationImportBaseStyles.fixedButtonsContainer,
                            { justifyContent: 'flex-end' },
                        ]}
                    >
                        <LoadingButton
                            variant="contained"
                            isLoading={buttonIsLoading}
                            onClick={handleCreateMetaAnalysisDetails}
                            disableElevation
                            loaderColor="secondary"
                            disabled={nextButtonDisabled}
                            sx={CurationImportBaseStyles.nextButton}
                            text={shouldCreateMetaAnalyses ? 'create' : 'finish'}
                        />
                    </Box>
                </Box>
            </Box>
        </StateHandlerComponent>
    );
};

export default SleuthImportWizardCreateMetaAnalyses;
