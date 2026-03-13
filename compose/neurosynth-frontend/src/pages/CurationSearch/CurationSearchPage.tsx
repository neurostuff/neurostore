import { Box } from '@mui/material';
import LoadingStateIndicatorProject from 'components/LoadingStateIndicator/LoadingStateIndicatorProject';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs';
import CurationSearch from 'pages/CurationSearch/components/CurationSearch';
import { useProjectId, useProjectName } from 'pages/Project/store/ProjectStore';

const CurationSearchPage: React.FC = () => {
    const projectId = useProjectId();
    const projectName = useProjectName();

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
                            text: 'Search & Curate',
                            link: `/projects/${projectId}/curation`,
                            isCurrentPage: false,
                        },
                        {
                            text: 'Search',
                            link: '',
                            isCurrentPage: true,
                        },
                    ]}
                />
                <LoadingStateIndicatorProject />
            </Box>
            <Box sx={{ marginTop: '1rem' }}>
                <CurationSearch />
            </Box>
        </Box>
    );
};

export default CurationSearchPage;
