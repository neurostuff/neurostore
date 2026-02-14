import { Box, Tooltip, Typography } from '@mui/material';
import DisplayLink from 'components/DisplayStudyLink/DisplayLink';
import DisplayStudyLinkFullText from 'components/DisplayStudyLink/DisplayStudyLinkFullText';
import LoadingStateIndicatorProject from 'components/LoadingStateIndicator/LoadingStateIndicatorProject';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs';
import { PUBMED_ARTICLE_URL_PREFIX, PUBMED_CENTRAL_ARTICLE_URL_PREFIX } from 'hooks/external/useFetchPubMedIds.types';
import { useProjectId, useProjectName } from 'pages/Project/store/ProjectStore';
import {
    useStudyAuthors,
    useStudyDOI,
    useStudyLastUpdated,
    useStudyName,
    useStudyPMCID,
    useStudyPMID,
    useStudyUsername,
    useStudyYear,
} from 'pages/Study/store/StudyStore';
import { useMemo } from 'react';

const EditStudyPageHeader: React.FC = () => {
    const projectId = useProjectId();
    const studyName = useStudyName();
    const studyYear = useStudyYear();
    const studyAuthors = useStudyAuthors();
    const projectName = useProjectName();
    const studyOwnerUsername = useStudyUsername();
    const lastUpdatedAt = useStudyLastUpdated();
    const doi = useStudyDOI();
    const pmid = useStudyPMID();
    const pmcid = useStudyPMCID();

    const nicelyFormattedDate = useMemo(() => {
        const date = new Date(lastUpdatedAt || '');
        return date.toDateString() + ' ' + date.toLocaleTimeString();
    }, [lastUpdatedAt]);

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <NeurosynthBreadcrumbs
                    breadcrumbItems={[
                        {
                            text: 'Projects',
                            link: '/projects',
                            isCurrentPage: false,
                        },
                        {
                            text: projectName || '',
                            link: `/projects/${projectId}`,
                            isCurrentPage: false,
                        },
                        {
                            text: 'Extraction',
                            link: `/projects/${projectId}/extraction`,
                            isCurrentPage: false,
                        },
                        {
                            text: studyName || '',
                            link: '',
                            isCurrentPage: true,
                        },
                    ]}
                />
                <LoadingStateIndicatorProject />
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', margin: '0.3rem 0' }}>
                <Typography variant="h5">
                    {studyYear && `(${studyYear}).`} {studyName}
                </Typography>
                {studyAuthors && (
                    <Typography variant="body2" sx={{ color: 'muted.main' }}>
                        {studyAuthors}
                    </Typography>
                )}
                <Typography variant="body2" sx={{ color: 'muted.main' }}>
                    Study owner: {studyOwnerUsername ? studyOwnerUsername : 'neurosynth'}
                </Typography>
                <Typography variant="body2" sx={{ color: 'muted.main' }}>
                    Last updated: {nicelyFormattedDate}
                </Typography>
            </Box>
            <Box sx={{ marginBottom: '0.7rem', display: 'flex' }}>
                {doi && <DisplayLink sx={{ marginRight: '1rem' }} label="DOI Link" href={`https://doi.org/${doi}`} />}
                {pmid && (
                    <DisplayLink
                        sx={{ marginRight: '1rem' }}
                        label="Pubmed Study"
                        href={`${PUBMED_ARTICLE_URL_PREFIX}${pmid}`}
                    />
                )}
                {pmcid && (
                    <Tooltip placement="top" title="View the full article in HTML form via PubMed Central">
                        <>
                            <DisplayLink
                                sx={{ marginRight: '1rem' }}
                                label="Full Text (web)"
                                href={`${PUBMED_CENTRAL_ARTICLE_URL_PREFIX}${pmcid}`}
                            />
                        </>
                    </Tooltip>
                )}
                {studyName && <DisplayStudyLinkFullText sx={{ marginRight: '1rem' }} studyName={studyName} />}
            </Box>
        </Box>
    );
};

export default EditStudyPageHeader;
