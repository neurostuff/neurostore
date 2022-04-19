import { Button, Step, StepLabel, Stepper } from '@mui/material';
import { useEffect, useState } from 'react';
import MetaAnalysisAlgorithm from '../../../components/MetaAnalysisConfigComponents/MetaAnalysisAlgorithm/MetaAnalysisAlgorithm';
import MetaAnalysisData from '../../../components/MetaAnalysisConfigComponents/MetaAnalysisData/MetaAnalysisData';
import MetaAnalysisFinalize from '../../../components/MetaAnalysisConfigComponents/MetaAnalysisFinalize/MetaAnalysisFinalize';
import { ENavigationButton } from '../../../components/NavigationButtons/NavigationButtons';
import useIsMounted from '../../../hooks/useIsMounted';
import API, { StudysetsApiResponse } from '../../../utils/api';

export enum EAlgorithmType {
    CBMA = 'CBMA',
    IBMA = 'IBMA',
}

export const MetaAnalyticAlgorithms = [
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
    const [studysets, setStudysets] = useState<StudysetsApiResponse[]>();
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
                        setStudysets(res.data.results);
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
                        Data
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
                        Algorithm
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
                        Finalize
                    </StepLabel>
                </Step>
            </Stepper>

            {activeStep === 0 && (
                <MetaAnalysisData
                    onNext={(button) => {
                        setActiveStep((prev) =>
                            button === ENavigationButton.NEXT ? ++prev : --prev
                        );
                    }}
                    studysets={studysets || []}
                />
            )}

            {activeStep === 1 && (
                <MetaAnalysisAlgorithm
                    onNext={(button) => {
                        setActiveStep((prev) =>
                            button === ENavigationButton.NEXT ? ++prev : --prev
                        );
                    }}
                />
            )}

            {activeStep === 2 && <MetaAnalysisFinalize />}

            {/* {activeStep === 1 && (
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
            )} */}
        </>
    );
};

export default MetaAnalysisBuilderPage;
