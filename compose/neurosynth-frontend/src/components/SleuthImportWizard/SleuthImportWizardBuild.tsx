import { Box, CircularProgress, LinearProgress, Typography } from '@mui/material';
import useIngest from 'hooks/studies/useIngest';
import {
    AnalysisRequest,
    BaseStudiesPost200Response,
    BaseStudy,
    BaseStudyReturn,
    BaseStudyVersions,
    StudyReturn,
} from 'neurostore-typescript-sdk';
import { useEffect, useRef, useState } from 'react';
import {
    ISleuthFileUploadStubs,
    ISleuthStub,
    extractAuthorsFromString,
    extractYearFromString,
    sleuthStubsToBaseStudies,
} from './SleuthImportWizard.utils';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useCreateStudy } from 'hooks';
import {
    lastUpdatedAtSortFn,
    selectBestVersionsForStudyset,
} from 'components/Dialogs/MoveToExtractionDialog/MovetoExtractionDialog.helpers';

const SleuthImportWizardBuild: React.FC<{
    sleuthUploads: ISleuthFileUploadStubs[];
    onPrevious: () => void;
    onNext: () => void;
}> = (props) => {
    const { mutateAsync: ingestAsync } = useIngest();
    const { mutateAsync: createStudyVersion } = useCreateStudy();
    const loadingState = useRef<{
        started: boolean;
    }>({
        started: false,
    });
    const { sleuthUploads, onPrevious, onNext } = props;
    const [isLoadingState, setIsLoadingState] = useState(false);
    const [isError, setIsError] = useState(false);

    useEffect(() => {
        if (sleuthUploads.length === 0) return;
        if (loadingState.current.started) return;

        loadingState.current.started = true;
        setIsLoadingState(true);

        const createProject = async () => {};

        const createAnnotation = async () => {};

        const createStudyset = async () => {};

        const ingest = async (
            baseStudies: BaseStudy[],
            sleuthUploads: ISleuthFileUploadStubs[]
        ) => {
            const allSleuthStudies = sleuthUploads.reduce((acc, curr) => {
                return [
                    ...acc,
                    ...curr.sleuthStubs.map((sleuthStub) => ({ ...sleuthStub, space: curr.space })),
                ];
            }, [] as (ISleuthStub & { space: string })[]);
            const res = await ingestAsync(baseStudies);
            const createVersionForEachSleuthStudyRequest = (res.data as BaseStudyReturn[]).map(
                (baseStudy) => {
                    const sourceId = ((baseStudy.versions || []) as StudyReturn[]).sort(
                        lastUpdatedAtSortFn
                    )[0].id;
                    const sleuthStudy = allSleuthStudies.find(
                        (sleuthStudy) =>
                            sleuthStudy.doi === baseStudy.doi || sleuthStudy.pmid === baseStudy.pmid
                    );
                    if (!sleuthStudy)
                        throw new Error(`No sleuth study found for base study: ${baseStudy.id}`);

                    const newAnalysis: AnalysisRequest = {
                        name: sleuthStudy.analysisName,
                        points: sleuthStudy.coordinates.map(({ x, y, z }) => ({
                            x,
                            y,
                            z,
                            space: sleuthStudy.space,
                        })),
                    };

                    if (!sourceId)
                        throw new Error(`No valid version ID for base study: ${baseStudy.id}`);

                    return createStudyVersion({
                        sourceId: sourceId,
                        data: {
                            analyses: [newAnalysis],
                        },
                    });
                }
            );

            return Promise.all(createVersionForEachSleuthStudyRequest);
        };

        const build = async (sleuthUploads: ISleuthFileUploadStubs[]) => {
            const baseStudies = sleuthStubsToBaseStudies(sleuthUploads);
            try {
                await ingest(baseStudies, sleuthUploads);
            } catch (e) {
                setIsError(true);
            }
        };

        build(sleuthUploads);
    }, [ingestAsync, sleuthUploads]);

    console.log({ sleuthUploads });

    return (
        <StateHandlerComponent isLoading={false} isError={isError}>
            <Box>
                {true ? (
                    <Box
                        sx={{
                            height: '300px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}
                    >
                        <Box sx={{ width: '100%' }}>
                            <LinearProgress
                                sx={{ height: '10px', marginTop: '2rem', marginBottom: '1rem' }}
                                variant="determinate"
                                value={20}
                            />
                        </Box>
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                            }}
                        >
                            <CircularProgress />
                            <Typography>abc def</Typography>
                            <Typography sx={{ marginTop: '1rem' }}>
                                (This may take a minute)
                            </Typography>
                        </Box>
                        {/* need this empty div to space out elements properly */}
                        <div></div>
                    </Box>
                ) : (
                    <></>
                )}
            </Box>
            {/* <Box sx={CurationImportBaseStyles.fixedContainer}>
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
                        onClick={() => {}}
                    >
                        next
                    </Button>
                </Box>
            </Box> */}
        </StateHandlerComponent>
    );
};

export default SleuthImportWizardBuild;
