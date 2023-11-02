import { Box, Button, Link, Typography } from '@mui/material';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import { ENavigationButton } from 'components/Buttons/NavigationButtons/NavigationButtons';
import useIngest from 'hooks/studies/useIngest';
import { BaseStudy, BaseStudyReturn } from 'neurostore-typescript-sdk';
import {
    useProjectCurationColumn,
    useProjectExtractionAnnotationId,
    useProjectExtractionStudysetId,
    useProjectId,
    useProjectNumCurationColumns,
} from 'pages/Projects/ProjectPage/ProjectStore';
import { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { selectBestVersionsForStudyset } from './helpers/utils';
import { useUpdateStudyset } from 'hooks';
import { setAnalysesInAnnotationAsIncluded } from 'pages/helpers/utils';

const MoveToExtractionIngest: React.FC<{
    onNavigate: (button: ENavigationButton) => void;
    onCloseDialog: () => void;
}> = (props) => {
    const projectId = useProjectId();
    const annotationId = useProjectExtractionAnnotationId();
    const studysetId = useProjectExtractionStudysetId();
    const numColumns = useProjectNumCurationColumns();
    const curationIncludedStudies = useProjectCurationColumn(numColumns - 1);
    const history = useHistory();
    const { mutateAsync: asyncIngest } = useIngest();
    const { mutateAsync: asyncUpdateStudyset } = useUpdateStudyset();
    const [isLoading, setIsLoading] = useState(false);

    const handleIngestion = async () => {
        if (!studysetId || !annotationId) return;

        setIsLoading(true);
        const includedStubs = curationIncludedStudies.stubStudies;

        // the BE ingestion only checks for these three properties
        const stubsToBaseStudies: Array<Pick<BaseStudy, 'name' | 'doi' | 'pmid'>> =
            includedStubs.map((stub) => ({
                name: stub.title,
                doi: stub.doi,
                pmid: stub.pmid,
            }));

        try {
            const res = await asyncIngest(stubsToBaseStudies);
            const returnedBaseStudies = res.data as Array<BaseStudyReturn>;

            const selectedStudyIds = selectBestVersionsForStudyset(returnedBaseStudies);
            await asyncUpdateStudyset({
                studysetId: studysetId,
                studyset: {
                    studies: selectedStudyIds,
                },
            });

            await setAnalysesInAnnotationAsIncluded(annotationId);

            setIsLoading(false);
            props.onCloseDialog();
            history.push(`/projects/${projectId}/extraction`);
        } catch (e) {
            setIsLoading(false);
            console.error(e);
        }
    };

    return (
        <Box>
            <Typography gutterBottom>
                Your annotation has been created - let's get started{' '}
                <Link
                    underline="hover"
                    target="_blank"
                    href="https://neurostuff.github.io/compose-docs/guide/walkthrough/Project/Extraction#ingestion"
                >
                    ingesting
                </Link>{' '}
                your studies.
            </Typography>
            <Typography gutterBottom>
                Neurosynth Compose will add the studies you included in the previous curation step
                to the database.
            </Typography>
            <Typography>
                If a matching study (or studies if there are multiple copies) already exists within
                the database, you will have the option of either <b>creating a brand new study</b>{' '}
                or <b>adding the existing neurostore study to your studyset</b>.
            </Typography>
            <Typography sx={{ marginBottom: '1rem' }} gutterBottom>
                To get started, click "START INGESTION" below
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Button disabled size="large">
                    BACK
                </Button>
                <LoadingButton
                    size="large"
                    loaderColor="secondary"
                    sx={{ width: '175px' }}
                    onClick={handleIngestion}
                    isLoading={isLoading}
                    variant="contained"
                    text="START INGESTION"
                />
            </Box>
        </Box>
    );
};

export default MoveToExtractionIngest;
