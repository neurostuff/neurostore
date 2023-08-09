import { Box } from '@mui/material';
import CurationImportBase from 'components/CurationComponents/CurationImport/CurationImportBase';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs/NeurosynthBreadcrumbs';
import { useProjectId, useProjectName } from 'stores/ProjectStore/getters';
import { useInitProjectStoreIfRequired } from 'stores/ProjectStore/setters';

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
                <CurationImportBase />
            </Box>
        </Box>
    );
};

export default CurationImportPage;
