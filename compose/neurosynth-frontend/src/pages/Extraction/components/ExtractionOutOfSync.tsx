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
import { STUDYSET_QUERY_STRING } from 'hooks/studysets/useGetStudysets';

const ExtractionOutOfSync: React.FC = (props) => {
    const studysetId = useProjectExtractionStudysetId();
    const annotationId = useProjectExtractionAnnotationId();
    const { data: studyset } = useGetStudysetById(studysetId, true); // set this to true as it is already cached in extractionPage
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

        const stubToStudyId = new Map<string, string>();
        (studyset?.studyset_studies || []).forEach((assoc) => {
            if (assoc.curation_stub_uuid && assoc.id) {
                stubToStudyId.set(assoc.curation_stub_uuid, assoc.id);
            }
        });

        const stubsNeedingIngest = curationIncludedStudies.stubStudies.filter(
            (stub) => !stubToStudyId.has(stub.id)
        );
        const existingStubPayload = curationIncludedStudies.stubStudies
            .filter((stub) => stubToStudyId.has(stub.id))
            .map((stub) => ({
                id: stubToStudyId.get(stub.id) as string,
                curation_stub_uuid: stub.id,
            }));

        const stubsToBaseStudies: Array<
            Pick<
                BaseStudy,
                'name' | 'doi' | 'pmid' | 'pmcid' | 'year' | 'description' | 'publication' | 'authors' | 'level'
            >
        > = stubsNeedingIngest.map((stub) => ({
            name: stub.title,
            doi: stub.doi ? stub.doi : undefined,
            pmid: stub.pmid ? stub.pmid : undefined,
            pmcid: stub.pmcid ? stub.pmcid : undefined,
            year: Number(stub.articleYear),
            description: stub.abstractText,
            publication: stub.journal,
            authors: stub.authors,
            level: 'group',
        }));

        const studiesInStudyset = new Set<string>();
        ((studyset?.studies || []) as Array<StudyReturn>).forEach((study) => {
            if (study.id) studiesInStudyset.add(study.id);
        });

        try {
            const returnedBaseStudies = stubsToBaseStudies.length
                ? ((await ingest(stubsToBaseStudies)).data as Array<BaseStudyReturn>)
                : [];

            const newStubPayload = mapStubsToStudysetPayload(
                stubsNeedingIngest,
                returnedBaseStudies,
                studiesInStudyset,
                undefined,
                stubToStudyId
            );
            const studiesPayload = [...existingStubPayload, ...newStubPayload];
            const curationStubMap = studiesPayload.reduce<Record<string, string>>((acc, item) => {
                if (item.curation_stub_uuid) acc[item.id] = item.curation_stub_uuid;
                return acc;
            }, {});

            const updatedStudyset = await updateStudyset({
                studysetId: studysetId,
                studyset: {
                    studies: studiesPayload,
                    curation_stub_map: curationStubMap,
                },
            });

            // Ensure cached studyset data is refreshed so curation/extraction stay aligned.
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
