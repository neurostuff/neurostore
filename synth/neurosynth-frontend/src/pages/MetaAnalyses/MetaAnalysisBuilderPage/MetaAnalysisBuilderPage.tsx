import { Box, Button, Step, StepLabel, Stepper, Autocomplete, TextField } from '@mui/material';
import { useEffect, useState } from 'react';
import useIsMounted from '../../../hooks/useIsMounted';
import API from '../../../utils/api';

export enum EAlgorithmType {
    CBMA = 'CBMA',
    IBMA = 'IBMA',
}

const MetaAnalyticAlgorithms = [
    { type: EAlgorithmType.CBMA, label: 'ALE', id: 'ALE' },
    { type: EAlgorithmType.CBMA, label: 'ALESubtraction', id: 'ALESubtraction' },
    { type: EAlgorithmType.CBMA, label: 'SCALE', id: 'SCALE' },
    { type: EAlgorithmType.CBMA, label: 'KDA', id: 'KDA' },
    { type: EAlgorithmType.CBMA, label: 'MKDAChi2', id: 'MKDAChi2' },
    { type: EAlgorithmType.CBMA, label: 'MKDADensity', id: 'MKDADensity' },
    { type: EAlgorithmType.CBMA, label: 'SDM', id: 'SDM' },
    { type: EAlgorithmType.CBMA, label: 'Model Based', id: 'Model Based' },
    { type: EAlgorithmType.IBMA, label: 'DerSimonianLaird', id: 'DerSimonianLaird' },
    { type: EAlgorithmType.IBMA, label: 'Fishers', id: 'Fishers' },
    { type: EAlgorithmType.IBMA, label: 'Hedges', id: 'Hedges' },
    { type: EAlgorithmType.IBMA, label: 'PermutedOLS', id: 'PermutedOLS' },
    {
        type: EAlgorithmType.IBMA,
        label: 'SampleSizeBasedLikelihood',
        id: 'SampleSizeBasedLikelihood',
    },
    { type: EAlgorithmType.IBMA, label: 'Stouffers', id: 'Stouffers' },
    { type: EAlgorithmType.IBMA, label: 'VarianceBasedLikelihood', id: 'VarianceBasedLikelihood' },
    { type: EAlgorithmType.IBMA, label: 'WeightedLeastSquares', id: 'WeightedLeastSquares' },
];

const MetaAnalysisBuilderPage: React.FC = (props) => {
    const [activeStep, setActiveStep] = useState(0);
    const [studysets, setStudysets] = useState<{ label: string; id: string }[] | undefined>();
    const [metaAnalysisComponents, setMetaAnalysisComponents] = useState<{
        studysetId: string | undefined;
        annotationId: string | undefined;
        algorithm: string | undefined;
    }>({
        studysetId: undefined,
        annotationId: undefined,
        algorithm: undefined,
    });
    const isMountedRef = useIsMounted();

    useEffect(() => {
        const getStudySets = async () => {
            API.Services.StudySetsService.studysetsGet(
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                false,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                ''
            )
                .then((res) => {
                    if (isMountedRef.current) {
                        const setOptions = (res.data.results || []).map((set) => ({
                            id: set.id || '',
                            label: set?.name || '',
                        }));

                        setStudysets(setOptions);
                    }
                })
                .catch((err) => {
                    console.error(err);
                });
        };

        getStudySets();
    }, [isMountedRef]);

    return (
        <>
            <Button sx={{ marginBottom: '1.5rem' }} color="secondary" variant="outlined">
                Return to my meta-analyses
            </Button>
            <Stepper sx={{ marginBottom: '1.5rem' }} activeStep={activeStep}>
                <Step>
                    <StepLabel
                        sx={{
                            '.MuiStepLabel-label': {
                                fontSize: '1rem',
                            },
                        }}
                    >
                        Studyset
                    </StepLabel>
                </Step>
                <Step>
                    <StepLabel
                        sx={{
                            '.MuiStepLabel-label': {
                                fontSize: '1rem',
                            },
                        }}
                    >
                        Specification
                    </StepLabel>
                </Step>
                <Step>
                    <StepLabel
                        sx={{
                            '.MuiStepLabel-label': {
                                fontSize: '1rem',
                            },
                        }}
                    >
                        Some third step?
                    </StepLabel>
                </Step>
            </Stepper>

            {activeStep === 0 && (
                <>
                    <Box sx={{ marginBottom: '1rem' }}>
                        Select the <b>studyset</b> that you would like to use for your meta analysis
                    </Box>

                    <Autocomplete
                        sx={{ width: '50%', marginBottom: '1rem' }}
                        value={studysets?.find(
                            (set) => set.id === metaAnalysisComponents?.studysetId
                        )}
                        onChange={(_event, value) =>
                            setMetaAnalysisComponents((prevState) => ({
                                ...prevState,
                                studysetId: value?.id || undefined,
                            }))
                        }
                        renderInput={(params) => <TextField {...params} label="studyset" />}
                        options={studysets || []}
                    />

                    <Box sx={{ marginBottom: '1rem' }}>
                        Select the <b>annotation</b> that you would like to use for your meta
                        analysis
                    </Box>

                    <Autocomplete
                        sx={{ width: '50%' }}
                        renderInput={(params) => <TextField {...params} label="annotation" />}
                        options={[
                            { label: 'an annotation', id: '1' },
                            { label: 'another annotation', id: '2' },
                        ]}
                    />
                </>
            )}
            {activeStep === 1 && (
                <>
                    <Box sx={{ marginBottom: '1rem' }}>
                        Specify the <b>column</b> you would like to use to include/exclude analyses
                    </Box>
                    <Autocomplete
                        sx={{ width: '50%', marginBottom: '1rem' }}
                        renderInput={(params) => (
                            <TextField {...params} label="inclusion/exclusion column" />
                        )}
                        options={[
                            { label: 'some column label', id: '12345' },
                            { label: 'another label', id: '843' },
                            { label: 'some other label', id: '3892' },
                        ]}
                    />

                    <Box sx={{ marginBottom: '1rem' }}>
                        Specify the <b>algorithm</b> you would like to use to run the meta analysis
                    </Box>
                    <Autocomplete
                        sx={{ width: '50%' }}
                        renderInput={(params) => <TextField {...params} label="algorithm" />}
                        groupBy={(option) => option.type}
                        options={MetaAnalyticAlgorithms}
                    />
                </>
            )}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
                <Button
                    disabled={activeStep === 0}
                    variant="outlined"
                    onClick={() =>
                        setActiveStep((prevStep) => (prevStep >= 1 ? prevStep - 1 : prevStep))
                    }
                    sx={{ fontSize: '1rem' }}
                >
                    Back
                </Button>
                <Button
                    variant={activeStep === 2 ? 'contained' : 'outlined'}
                    onClick={() =>
                        setActiveStep((prevStep) => (prevStep <= 1 ? prevStep + 1 : prevStep))
                    }
                    sx={{ fontSize: '1rem' }}
                >
                    {activeStep === 2 ? 'RUN META-META ANALYSIS' : 'NEXT'}
                </Button>
            </Box>
        </>
    );
};

export default MetaAnalysisBuilderPage;
