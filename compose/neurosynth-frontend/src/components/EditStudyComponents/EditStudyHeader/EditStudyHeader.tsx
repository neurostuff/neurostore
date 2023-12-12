import { Box, Typography } from '@mui/material';
import DisplayStudyChipLinks from 'components/DisplayStudy/DisplayStudyChipLinks/DisplayStudyChipLinks';
import EditStudyToolbar from 'components/EditStudyComponents/EditStudyToolbar/EditStudyToolbar';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs/NeurosynthBreadcrumbs';
import ProjectIsLoadingText from 'pages/CurationPage/ProjectIsLoadingText';
import { useProjectId, useProjectName } from 'pages/Projects/ProjectPage/ProjectStore';
import {
    useStudyId,
    useStudyLastUpdated,
    useStudyName,
    useStudyUsername,
} from 'pages/Studies/StudyStore';
import { useMemo } from 'react';

const EditStudyPageHeader: React.FC = (props) => {
    const studyId = useStudyId();
    const projectId = useProjectId();
    const studyName = useStudyName();
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
                                link: `/projects/${projectId}/extraction/studies/${studyId}`,
                                isCurrentPage: true,
                            },
                        ]}
                    />
                    <ProjectIsLoadingText />
                </Box>
                <Box sx={{ margin: '5px 0 10px 0', display: 'flex' }}>
                    <Box>
                        <Typography variant="body2" sx={{ color: 'muted.main' }}>
                            Study owner: {studyOwnerUsername ? studyOwnerUsername : 'neurosynth'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'muted.main' }}>
                            Last updated: {nicelyFormattedDate}
                        </Typography>
                    </Box>
                </Box>
                <Box>
                    <DisplayStudyChipLinks />
                </Box>
            </Box>
        </>
    );
};

export default EditStudyPageHeader;
