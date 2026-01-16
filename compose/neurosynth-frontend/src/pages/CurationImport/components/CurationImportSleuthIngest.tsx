import { useAuth0 } from '@auth0/auth0-react';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { Box, Button, CircularProgress, LinearProgress, Typography } from '@mui/material';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import useGetPubMedIdFromDOI from 'hooks/external/useGetPubMedIdFromDOI';
import { useFetchPubMedIds } from 'hooks';
import useIngest from 'hooks/studies/useIngest';
import { BaseStudy } from 'neurostore-typescript-sdk';
import CurationImportStyles from 'pages/CurationImport/components/CurationImport.styles';
import { useEffect, useRef, useState } from 'react';
import {
    applyPubmedStudyDetailsToBaseStudiesAndRemoveDuplicates,
    ingestBaseStudies,
    ISleuthFileUploadStubs,
    lookForPMIDsAndFetchStudyDetails,
    sleuthIngestedStudiesToStubs,
    sleuthStubsToBaseStudies,
} from '../../CurationImport/helpers';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';

const updateUploadSummary = (sleuthUpload: ISleuthFileUploadStubs) => {
    const numCoordinatesImported = sleuthUpload.sleuthStubs.reduce((acc, curr) => {
        return acc + curr.coordinates.length;
    }, 0);

    return {
        numAnalyses: sleuthUpload.sleuthStubs.length,
        numCoordinates: numCoordinatesImported,
    };
};

const CurationImportSleuthIngest: React.FC<{
    sleuthUploads: ISleuthFileUploadStubs[];
    onStubsUploaded: (stubs: ICurationStubStudy[]) => void;
}> = ({ sleuthUploads, onStubsUploaded }) => {
    const { user } = useAuth0();
    const { mutateAsync: fetchPubmedIds } = useFetchPubMedIds();
    const { mutateAsync: getPubMedIdFromDOI } = useGetPubMedIdFromDOI();
    const { mutateAsync: ingestAsync } = useIngest();

    const hasStarted = useRef<boolean>(false);
    const [sleuthStudyStubs, setSleuthStudyStubs] = useState<ICurationStubStudy[] | undefined>([]);
    const [isLoadingState, setIsLoadingState] = useState(true);
    const [isError, setIsError] = useState(false);
    const [progressText, setProgressText] = useState('');
    const [progressValue, setProgressValue] = useState(0);

    useEffect(() => {
        if (sleuthUploads.length === 0) return;
        if (hasStarted.current) return;

        hasStarted.current = true;
        setIsLoadingState(true);

        const build = async (sleuthUploads: ISleuthFileUploadStubs[]) => {
            if (!user?.sub) return;

            try {
                setProgressValue(0);
                setProgressText('Starting upload...');

                const studyAnalysisList: {
                    studyId: string;
                    analysisId: string;
                    doi: string;
                    pmid: string;
                }[] = [];
                const baseStudiesFromSleuthStubs: BaseStudy[] = [];

                let index = 0;
                const percentageIncrement = 100 / sleuthUploads.length;
                for (const sleuthUpload of sleuthUploads) {
                    setProgressText(
                        `Fetching study details for studies within ${sleuthUpload.fileName} (if they exist)...`
                    );
                    const percentageAlreadyComplete = index * percentageIncrement;
                    // 1. convert sleuth stubs to a format neurosynth compose recognizes
                    const baseStudySleuthStubs = sleuthStubsToBaseStudies(sleuthUpload.sleuthStubs);

                    // 2. query pubmed for PMIDs based on the DOIs supplied. Fetch studies by PMIDs
                    const pubmedArticlesForSleuthStubs = await lookForPMIDsAndFetchStudyDetails(
                        baseStudySleuthStubs,
                        getPubMedIdFromDOI,
                        (progress) => {
                            setProgressValue(
                                Math.round((progress / 100) * (percentageIncrement / 2) + percentageAlreadyComplete)
                            );
                        },
                        fetchPubmedIds
                    );

                    setProgressText(`Adding ${sleuthUpload.fileName} studies into the database...`);

                    // 3. From the previous step, take our initial undetailed base studies and add details from pubmed
                    // Remove duplicates. The ingestion endpoint will take these base studies and either
                    // (1) create a new study with a version if one does not exist or (2) return an existing study
                    const baseStudiesWithPubmedDetailsNoDuplicates =
                        applyPubmedStudyDetailsToBaseStudiesAndRemoveDuplicates(
                            baseStudySleuthStubs,
                            pubmedArticlesForSleuthStubs
                        );

                    // 4. ingest the base studies and consolidate the sleuth stubs into Studies.
                    // We could potentially have multiple of the same study across the uploads
                    // If N sleuth stubs have the same DOI/PMID, then a study object is created, with N analyses representing each sleuth stub
                    const studyAnalysisObjects = await ingestBaseStudies(
                        baseStudiesWithPubmedDetailsNoDuplicates,
                        sleuthUpload,
                        user.sub as string,
                        ingestAsync,
                        (progress) => {
                            setProgressValue(
                                Math.round(
                                    (progress / 100) * (percentageIncrement / 2) +
                                        (percentageAlreadyComplete + percentageIncrement / 2)
                                )
                            );
                        }
                    );
                    studyAnalysisList.push(...studyAnalysisObjects);
                    baseStudiesFromSleuthStubs.push(...baseStudiesWithPubmedDetailsNoDuplicates);
                    index++;
                }

                const stubs = sleuthIngestedStudiesToStubs(studyAnalysisList, baseStudiesFromSleuthStubs);
                setSleuthStudyStubs(stubs);

                setProgressValue(100);
                setProgressText('Complete...');
                setIsLoadingState(false);
            } catch (e) {
                console.error(e);
                setIsError(true);
            }
        };

        build(sleuthUploads);
    }, [ingestAsync, onStubsUploaded, sleuthUploads, user, fetchPubmedIds, getPubMedIdFromDOI]);

    const handleNext = () => {
        if (!sleuthStudyStubs) throw new Error('No sleuth study stubs found');
        onStubsUploaded(sleuthStudyStubs);
    };

    return (
        <StateHandlerComponent isLoading={false} isError={isError}>
            <Box my={2}>
                {isLoadingState ? (
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
                                value={progressValue}
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
                            <Typography>{progressText}</Typography>
                            <Typography sx={{ marginTop: '1rem' }}>(This may take a minute)</Typography>
                        </Box>
                        {/* need this empty div to space out elements properly */}
                        <div></div>
                    </Box>
                ) : (
                    <Box>
                        <Box>
                            <Typography variant="h5" sx={{ marginBottom: '2rem' }}>
                                Import Complete
                            </Typography>
                            {sleuthUploads.map((upload, index) => {
                                const { numAnalyses, numCoordinates } = updateUploadSummary(upload);

                                return (
                                    <Box key={index} marginBottom="1rem">
                                        <Typography
                                            variant="h6"
                                            display="flex"
                                            gutterBottom
                                            alignItems="center"
                                            color="primary"
                                        >
                                            <InsertDriveFileIcon color="primary" sx={{ marginRight: '10px' }} />
                                            {upload.fileName}
                                        </Typography>
                                        <Typography>
                                            Successfully extracted and imported <b>{numCoordinates} coordinates </b>
                                            across <b>{numAnalyses} analyses</b>
                                        </Typography>
                                    </Box>
                                );
                            })}
                        </Box>
                        <Box sx={CurationImportStyles.fixedContainer}>
                            <Box sx={[CurationImportStyles.fixedButtonsContainer, { justifyContent: 'flex-end' }]}>
                                <Button
                                    variant="contained"
                                    sx={CurationImportStyles.nextButton}
                                    disableElevation
                                    onClick={handleNext}
                                >
                                    next
                                </Button>
                            </Box>
                        </Box>
                    </Box>
                )}
            </Box>
        </StateHandlerComponent>
    );
};

export default CurationImportSleuthIngest;
