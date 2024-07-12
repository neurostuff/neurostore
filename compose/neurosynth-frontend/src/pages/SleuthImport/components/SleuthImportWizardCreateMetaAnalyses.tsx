import { IAlgorithmSelection } from 'pages/MetaAnalysis/components/CreateMetaAnalysisSpecificationDialogBase.types';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import useGetProjectById from 'hooks/projects/useGetProjectById';
import { useNavigate } from 'react-router-dom';
import { ISleuthFileUploadStubs } from '../SleuthImport.helpers';
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
import CurationImportBaseStyles from 'pages/CurationImport/components/CurationImport.styles';
import {
    getDefaultValuesForTypeAndParameter,
    metaAnalyticAlgorithms,
} from 'pages/MetaAnalysis/components/CreateMetaAnalysisSpecificationDialogConstants';
import { IAutocompleteObject } from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';
import { useMemo, useState } from 'react';
import LoadingButton from 'components/Buttons/LoadingButton';
import { getWeightAndConditionsForSpecification } from 'pages/MetaAnalysis/components/CreateMetaAnalysisSpecificationReview.helpers';
import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
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
    const { createMetaAnalysis } = useCreateAlgorithmSpecification();
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
                // Later on, the library HandsOnTable will be used to render the annotaiton in a spreadsheet like UI.
                // We want to use the filename as a key, but we cannot include periods due to this issue:
                // https://github.com/handsontable/handsontable/issues/5439
                //
                // As a result, we should remove the period from the filename
                const filenameReplacePeriodsWithUnderscores = sleuthImport.fileName.replaceAll(
                    '.',
                    '_'
                );

                const { weights, conditions, databaseStudyset } =
                    getWeightAndConditionsForSpecification(
                        selectedMetaAnalysisAlgorithm.estimator,
                        {
                            selectionKey: filenameReplacePeriodsWithUnderscores,
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
                    filenameReplacePeriodsWithUnderscores,
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
                <Typography gutterBottom sx={{ marginBottom: '1rem', color: 'muted.main' }}>
                    This will automatically create a new meta-analysis specification for each
                    separate file assuming they are distinct sets of coordinates.
                    <br />
                    This step is optional. You can skip this and create a custom meta-analysis
                    later.
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
                            Default parameters will be used. If you are unsure, we suggest starting
                            with MKDADensity. To replicate GingerALE, select ALE.
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
