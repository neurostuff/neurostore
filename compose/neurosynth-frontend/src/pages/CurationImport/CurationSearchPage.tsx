import { Box } from '@mui/material';
import LoadingStateIndicatorProject from 'components/LoadingStateIndicator/LoadingStateIndicatorProject';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs';
import Search from 'pages/CurationImport/components/Search';
import { useProjectId, useProjectName } from 'stores/projects/ProjectStore';

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
                <Search />
            </Box>
        </Box>
    );
};

export default CurationSearchPage;
