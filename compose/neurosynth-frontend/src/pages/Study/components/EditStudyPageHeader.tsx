import { Box, Typography } from '@mui/material';
import DisplayStudyChipLinks from 'components/DisplayStudyChipLinks/DisplayStudyChipLinks';
import EditStudyToolbar from 'pages/Study/components/EditStudyToolbar';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs';
import ProjectIsLoadingText from 'components/ProjectIsLoadingText';
import { useProjectId, useProjectName } from 'pages/Project/store/ProjectStore';
import {
    useStudyId,
    useStudyLastUpdated,
    useStudyName,
    useStudyYear,
    useStudyAuthors,
    useStudyUsername,
} from 'pages/Study/store/StudyStore';
import { useMemo } from 'react';

const EditStudyPageHeader: React.FC = () => {
    const studyId = useStudyId();
    const projectId = useProjectId();
    const studyName = useStudyName();
    const studyYear = useStudyYear();
    const studyAuthors = useStudyAuthors();
    const projectName = useProjectName();
    const studyOwnerUsername = useStudyUsername();
    const lastUpdatedAt = useStudyLastUpdated();

    const nicelyFormattedDate = useMemo(() => {
        const date = new Date(lastUpdatedAt || '');
        return date.toDateString() + ' ' + date.toLocaleTimeString();
    }, [lastUpdatedAt]);

    return (
        <>
            <EditStudyToolbar />
            <Box sx={{ marginBottom: '0.5rem' }}>
                <Box sx={{ display: 'flex' }}>
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
                                link: `/projects/${projectId}/extraction/studies/${studyId}/edit`,
                                isCurrentPage: true,
                            },
                        ]}
                    />
                    <ProjectIsLoadingText />
                </Box>
                <Box sx={{ marginTop: '1rem', display: 'flex', flexDirection: 'column' }}>
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
                    <Typography variant="caption" sx={{ color: 'muted.main' }}>
                        Last updated: {nicelyFormattedDate}
                    </Typography>
                </Box>
                <Box sx={{ margin: '0.5rem 0 1rem 0' }}>
                    <DisplayStudyChipLinks />
                </Box>
            </Box>
        </>
    );
};

export default EditStudyPageHeader;
