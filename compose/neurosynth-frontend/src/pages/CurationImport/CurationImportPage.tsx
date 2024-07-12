import { Box } from '@mui/material';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs';
import {
    useInitProjectStoreIfRequired,
    useProjectId,
    useProjectName,
} from 'pages/Project/store/ProjectStore';
import CurationImport from 'pages/CurationImport/components/CurationImport';

const CurationImportPage: React.FC = (props) => {
    useInitProjectStoreIfRequired();
    const projectId = useProjectId();
    const projectName = useProjectName();

    return (
        <Box>
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
            </Box>
            <Box sx={{ marginTop: '1rem' }}>
                <CurationImport />
            </Box>
        </Box>
    );
};

export default CurationImportPage;
