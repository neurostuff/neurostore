import { Box } from '@mui/material';
import LoadingStateIndicatorProject from 'components/LoadingStateIndicator/LoadingStateIndicatorProject';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs';
import CurationImport from 'pages/CurationImport/components/CurationImport';
import { useProjectId, useProjectName } from 'pages/Project/store/ProjectStore';

const CurationImportPage: React.FC = (props) => {
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
                            text: 'Import',
                            link: '',
                            isCurrentPage: true,
                        },
                    ]}
                />
                <LoadingStateIndicatorProject />
            </Box>
            <Box sx={{ marginTop: '1rem' }}>
                <CurationImport />
            </Box>
        </Box>
    );
};

export default CurationImportPage;
