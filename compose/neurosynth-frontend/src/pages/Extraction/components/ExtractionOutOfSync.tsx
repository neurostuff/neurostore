import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { Box, Typography } from '@mui/material';
import LoadingButton from 'components/Buttons/LoadingButton';
import { useGetStudysetById, useUpdateStudyset } from 'hooks';
import useIngest from 'hooks/studies/useIngest';
import { BaseStudy, BaseStudyReturn, StudyReturn } from 'neurostore-typescript-sdk';
import { useSnackbar } from 'notistack';
import {
    useAllowEditMetaAnalyses,
    useProjectCurationColumn,
    useProjectExtractionAnnotationId,
    useProjectExtractionStudysetId,
    useProjectNumCurationColumns,
} from 'pages/Project/store/ProjectStore';
import { setAnalysesInAnnotationAsIncluded } from 'helpers/Annotation.helpers';
import { useState } from 'react';
import { useIsFetching, useQueryClient } from 'react-query';
import ExtractionOutOfSyncStyles from './ExtractionOutOfSync.styles';
import { mapStubsToStudysetPayload } from 'helpers/Extraction.helpers';
import { STUDYSET_QUERY_STRING } from 'hooks/studysets/useGetStudysetById';

const ExtractionOutOfSync: React.FC = () => {
    const studysetId = useProjectExtractionStudysetId();
    const annotationId = useProjectExtractionAnnotationId();
    const { data: studyset } = useGetStudysetById(studysetId, false, true); // summary payload should already be cached by ExtractionPage
    const numColumns = useProjectNumCurationColumns();
    const setAllowEditMetaAnalyses = useAllowEditMetaAnalyses();
    const curationIncludedStudies = useProjectCurationColumn(numColumns - 1);
    const { mutateAsync: ingest } = useIngest();
    const { mutateAsync: updateStudyset } = useUpdateStudyset();
    const getStudysetIsRefetching = useIsFetching('studysets');
    const { enqueueSnackbar } = useSnackbar();
    const queryClient = useQueryClient();

    const [isLoading, setIsLoading] = useState(false);

    const handleResolveOutOfSyncIssue = async () => {
        if (!studysetId || !annotationId) return;
        setIsLoading(true);

        // create stub to study version mapping
        const stubToStudyId = new Map<string, string>();
        // studyset.studyset_studies is the backend mapping of study IDs to curation stub IDs
        (studyset?.studyset_studies || []).forEach((studysetStudy) => {
            if (studysetStudy.curation_stub_uuid && studysetStudy.id) {
                stubToStudyId.set(studysetStudy.curation_stub_uuid, studysetStudy.id);
            }
        });

        // create set of all study versions in the studyset
        const studiesInStudyset = new Set<string>();
        ((studyset?.studies || []) as Array<StudyReturn>).forEach((study) => {
            if (study.id) studiesInStudyset.add(study.id);
        });

        // get stubs that are in the studyset
        const existingStubPayload = curationIncludedStudies.stubStudies
            .filter((stub) => stubToStudyId.has(stub.id))
            .map((stub) => ({
                id: stubToStudyId.get(stub.id) as string,
                curation_stub_uuid: stub.id,
            }));

        // get stubs that are not in the studyset (and need to be ingested). Convert to base study payload.
        const stubsNeedingIngest = curationIncludedStudies.stubStudies.filter((stub) => !stubToStudyId.has(stub.id));
        const stubsToBaseStudies: Array<
            Pick<
                BaseStudy,
                'name' | 'doi' | 'pmid' | 'pmcid' | 'year' | 'description' | 'publication' | 'authors' | 'level'
            >
        > = stubsNeedingIngest.map((stub) => {
            const year = Number(stub.articleYear);
            return {
                name: stub.title,
                doi: stub.doi || undefined,
                pmid: stub.pmid || undefined,
                pmcid: stub.pmcid || undefined,
                year: isNaN(year) ? undefined : year,
                description: stub.abstractText,
                publication: stub.journal,
                authors: stub.authors,
                level: 'group',
            };
        });

        try {
            const returnedBaseStudies = stubsToBaseStudies.length
                ? ((await ingest(stubsToBaseStudies)).data as Array<BaseStudyReturn>)
                : [];

            const newStubPayload = mapStubsToStudysetPayload(
                stubsNeedingIngest,
                returnedBaseStudies,
                studiesInStudyset,
                stubToStudyId
            );
            const studiesPayload = [...existingStubPayload, ...newStubPayload];

            const updatedStudyset = await updateStudyset({
                studysetId: studysetId,
                studyset: {
                    studies: studiesPayload,
                },
            });

            // Invalidate cached studyset data to ensure subsequent queries reflect the newly updated stub mappings,
            // keeping curation and extraction aligned.
            await queryClient.invalidateQueries(STUDYSET_QUERY_STRING);

            queryClient.invalidateQueries('annotations');

            await setAnalysesInAnnotationAsIncluded(annotationId);

            enqueueSnackbar('synced curation and studyset successfully', { variant: 'success' });

            if (updatedStudyset.data.studies && updatedStudyset.data.studies.length === 0) {
                setAllowEditMetaAnalyses(false);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Box sx={ExtractionOutOfSyncStyles.banner}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ErrorOutlineIcon sx={{ marginRight: '10px', fontSize: '2.5rem' }} />
                <Box>
                    <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                        <b>This studyset is out of sync</b>
                    </Typography>
                    <Typography>
                        The curation phase was updated and no longer reflects what is in the studyset.
                    </Typography>
                    <Typography>
                        Click "FIX THIS ISSUE" in order to update the studyset with the studies included in the curation
                        phase.
                    </Typography>
                </Box>
            </Box>
            <LoadingButton
                text="Fix this issue"
                isLoading={isLoading || getStudysetIsRefetching > 0}
                loaderColor="secondary"
                sx={{ marginTop: '1rem', width: '200px' }}
                onClick={handleResolveOutOfSyncIssue}
                variant="contained"
            />
        </Box>
    );
};

export default ExtractionOutOfSync;
