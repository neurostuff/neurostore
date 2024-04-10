import { useAuth0 } from '@auth0/auth0-react';
import { Box, Typography } from '@mui/material';
import SearchContainer from 'components/Search/SearchContainer/SearchContainer';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useGuard } from 'hooks';
import { INeurosynthProjectReturn } from 'hooks/projects/useGetProjects';
import ProjectsPageCard from '../../../components/ProjectsPageComponents/ProjectsPageCard';
import useSearchProjects from './useSearchProjects';

const ProjectsPage: React.FC = (props) => {
    const { isAuthenticated, isLoading: authIsLoading, user } = useAuth0();
    useGuard('/', 'Please log in', !authIsLoading && !isAuthenticated);

    const {
        handlePageChange,
        handleRowsPerPageChange,
        handleSearch,
        isError,
        isLoading,
        projectsResponse,
        pageSize,
        pageOfResults,
    } = useSearchProjects(user?.sub);

    return (
        <StateHandlerComponent isLoading={false} isError={isError}>
            <Box sx={{ display: 'flex' }}>
                <Typography gutterBottom variant="h4">
                    My Projects
                </Typography>
            </Box>

            <SearchContainer
                searchMode="project-search"
                onPageChange={handlePageChange}
                onRowsPerPageChange={handleRowsPerPageChange}
                onSearch={handleSearch}
                totalCount={(projectsResponse?.metadata as any)?.total_count || 0}
                pageSize={pageSize}
                pageOfResults={(projectsResponse?.results || []).length === 0 ? 1 : pageOfResults}
            >
                <StateHandlerComponent isLoading={isLoading} isError={isError}>
                    {(projectsResponse?.results || []).map((project) => (
                        <Box
                            key={project?.id || ''}
                            sx={{
                                ':nth-of-type(2n)': {
                                    backgroundColor: '#f7f7f7',
                                    borderRadius: '4px',
                                },
                            }}
                        >
                            <ProjectsPageCard {...(project as INeurosynthProjectReturn)} />
                        </Box>
                    ))}
                </StateHandlerComponent>
            </SearchContainer>
        </StateHandlerComponent>
    );
};

export default ProjectsPage;
