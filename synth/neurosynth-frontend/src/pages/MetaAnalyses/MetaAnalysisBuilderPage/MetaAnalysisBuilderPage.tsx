import { useAuth0 } from '@auth0/auth0-react';
import { Button, Step, StepLabel, Stepper } from '@mui/material';
import { useEffect, useState } from 'react';
import { IDynamicInputType } from '../../../components/MetaAnalysisConfigComponents';
import MetaAnalysisAlgorithm from '../../../components/MetaAnalysisConfigComponents/MetaAnalysisAlgorithm/MetaAnalysisAlgorithm';
import MetaAnalysisData from '../../../components/MetaAnalysisConfigComponents/MetaAnalysisData/MetaAnalysisData';
import MetaAnalysisFinalize from '../../../components/MetaAnalysisConfigComponents/MetaAnalysisFinalize/MetaAnalysisFinalize';
import { ENavigationButton } from '../../../components/NavigationButtons/NavigationButtons';
import { IAutocompleteObject } from '../../../components/NeurosynthAutocomplete/NeurosynthAutocomplete';
import useIsMounted from '../../../hooks/useIsMounted';
import { Specification } from '../../../neurosynth-compose-typescript-sdk';
import API, { AnnotationsApiResponse, StudysetsApiResponse } from '../../../utils/api';

export enum EAnalysisType {
    CBMA = 'CBMA',
    IBMA = 'IBMA',
}

export interface IAnalysisComponents {
    analysisType: EAnalysisType | undefined;
    algorithm: IAutocompleteObject | undefined | null;
    estimator: IAutocompleteObject | undefined | null;
    corrector: IAutocompleteObject | undefined | null;
    studyset: StudysetsApiResponse | undefined | null;
    annotation: AnnotationsApiResponse | undefined | null;
}

export interface IDynamicArgs {
    estimatorArgs: IDynamicInputType;
    correctorArgs: IDynamicInputType;
}

const MetaAnalysisBuilderPage: React.FC = (props) => {
    const [activeStep, setActiveStep] = useState(0);
    const [studysets, setStudysets] = useState<StudysetsApiResponse[]>();
    const [metaAnalysisComponents, setMetaAnalysisComponents] = useState<IAnalysisComponents>({
        // data step
        analysisType: undefined,
        studyset: undefined,
        annotation: undefined,
        // algorithm step
        algorithm: undefined,
        estimator: undefined,
        corrector: undefined,
    });
    const [metaAnalysisDynamicArgs, setMetaAnalysisDynamicArgs] = useState<IDynamicArgs>({
        estimatorArgs: {},
        correctorArgs: {},
    });

    const { getAccessTokenSilently } = useAuth0();

    useEffect(() => {
        if (!metaAnalysisComponents.algorithm) {
            setMetaAnalysisDynamicArgs({
                estimatorArgs: {},
                correctorArgs: {},
            });
        }
    }, [metaAnalysisComponents.algorithm]);

    useEffect(() => {
        if (!metaAnalysisComponents.corrector) {
            setMetaAnalysisDynamicArgs((prevState) => ({
                ...prevState,
                correctorArgs: {},
            }));
        }
    }, [metaAnalysisComponents.corrector]);

    const { current } = useIsMounted();

    const handleUpdate = (arg: Partial<IAnalysisComponents>) => {
        setMetaAnalysisComponents((prevStep) => ({
            ...prevStep,
            ...arg,
        }));
    };

    const handleArgsUpdate = (arg: Partial<IDynamicArgs>) => {
        setMetaAnalysisDynamicArgs((prevState) => {
            // only one of correctorArgs or estimatorArgs will be updated at any given time
            const key = arg.correctorArgs ? 'correctorArgs' : 'estimatorArgs';
            return {
                ...prevState,
                [key]: {
                    ...prevState[key],
                    ...arg[key],
                },
            };
        });
    };

    const handleCreateMetaAnalysis = async () => {
        console.log('CREATE');

        let corrector = null;
        if (metaAnalysisComponents.corrector) {
            corrector = {
                type: metaAnalysisComponents.corrector?.label,
                args: {},
            };

            if (Object.keys(metaAnalysisDynamicArgs.correctorArgs).length > 0) {
                corrector.args = metaAnalysisDynamicArgs.correctorArgs;
            }
        }

        const spec: Specification = {
            type: metaAnalysisComponents.analysisType,
            estimator: {
                type: metaAnalysisComponents.algorithm?.label,
                args: metaAnalysisDynamicArgs.estimatorArgs,
            },
            corrector: metaAnalysisComponents.corrector ? corrector : null,
        };
        // API.NeurostoreServices.SpecificationsService.specificationsPost(spec)
        //     .then((res) => {
        //         console.log(res);
        //     })
        //     .then((res) => {
        //         const metaAnalysis: MetaAnalysis = {};
        //         // API.Services.MetaAnalysisService.metaAnalysesPost()
        //     })
        //     .catch((err) => {
        //         console.error(err);
        //     });
        // API.Services.SpecificationsService;
    };

    useEffect(() => {
        const getStudySets = async () => {
            API.NeurostoreServices.StudySetsService.studysetsGet(
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
                    if (current) {
                        setStudysets(res.data.results);
                    }
                })
                .catch((err) => {
                    console.error(err);
                });
        };

        getStudySets();
    }, [current]);

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
                    onUpdate={handleUpdate}
                    analysisType={metaAnalysisComponents.analysisType}
                    studyset={metaAnalysisComponents.studyset}
                    annotation={metaAnalysisComponents.annotation}
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
                    analysisType={metaAnalysisComponents.analysisType as EAnalysisType}
                    algorithm={metaAnalysisComponents.algorithm}
                    estimator={metaAnalysisComponents.estimator}
                    estimatorArgs={metaAnalysisDynamicArgs.estimatorArgs}
                    corrector={metaAnalysisComponents.corrector}
                    correctorArgs={metaAnalysisDynamicArgs.correctorArgs}
                    onUpdate={handleUpdate}
                    onArgsUpdate={handleArgsUpdate}
                    onNext={(button) => {
                        setActiveStep((prev) =>
                            button === ENavigationButton.NEXT ? ++prev : --prev
                        );
                    }}
                />
            )}

            {activeStep === 2 && (
                <MetaAnalysisFinalize
                    onNext={(button) => {
                        button === ENavigationButton.NEXT
                            ? handleCreateMetaAnalysis()
                            : setActiveStep((prev) => --prev);
                    }}
                    analysisType={metaAnalysisComponents.analysisType as EAnalysisType}
                    algorithm={metaAnalysisComponents.algorithm}
                    estimator={metaAnalysisComponents.estimator}
                    estimatorArgs={metaAnalysisDynamicArgs.estimatorArgs}
                    corrector={metaAnalysisComponents.corrector}
                    correctorArgs={metaAnalysisDynamicArgs.correctorArgs}
                    studyset={metaAnalysisComponents.studyset}
                    annotation={metaAnalysisComponents.annotation}
                />
            )}
        </>
    );
};

export default MetaAnalysisBuilderPage;
