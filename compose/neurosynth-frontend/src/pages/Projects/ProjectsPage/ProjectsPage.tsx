import { useAuth0 } from '@auth0/auth0-react';
import SearchIcon from '@mui/icons-material/Search';
import { Box, Button, InputBase, Link, Paper, Typography } from '@mui/material';
import ProgressLoader from 'components/ProgressLoader/ProgressLoader';
import SearchBarStyles from 'components/Search/SearchBar/SearchBar.styles';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useCreateProject, useGuard } from 'hooks';
import useGetProjects, { INeurosynthProjectReturn } from 'hooks/projects/useGetProjects';
import { useIsMutating } from 'react-query';
import { useNavigate } from 'react-router-dom';
import ProjectsPageCard from '../../../components/ProjectsPageComponents/ProjectsPageCard';
import { generateNewProjectData } from '../ProjectPage/ProjectStore.helpers';

const ProjectsPage: React.FC = (props) => {
    const { user, isAuthenticated } = useAuth0();
    const {
        data,
        isError,
        isLoading: getProjectsIsLoading,
        isFetching,
    } = useGetProjects(user?.sub);
    const createProjectIsFetchingNum = useIsMutating('create-project');
    const navigate = useNavigate();
    const { mutate, isLoading: createProjectIsLoading } = useCreateProject();
    useGuard('/', 'not authenticated', !isAuthenticated);

    const handleCreateProject = () => {
        mutate(generateNewProjectData('Untitled', ''), {
            onSuccess: (arg) => {
                navigate(`/projects/${arg.data.id || ''}`);
            },
        });
    };

    const handleSelectProject = (project: INeurosynthProjectReturn) => {
        if (project?.provenance?.metaAnalysisMetadata?.canEditMetaAnalyses) {
            navigate(`/projects/${project?.id}/meta-analyses`);
        } else {
            navigate(`/projects/${project?.id}/project`);
        }
    };

    const createProjectIsFetching = createProjectIsFetchingNum > 0;
    const noProjects = (data?.length || []) === 0;

    return (
        <StateHandlerComponent isLoading={getProjectsIsLoading} isError={isError}>
            <Box sx={{ display: 'flex' }}>
                <Typography gutterBottom variant="h4">
                    My Projects
                </Typography>
            </Box>

            {noProjects ? (
                <Typography>
                    You haven't created a project yet.{' '}
                    {createProjectIsLoading ? (
                        <ProgressLoader size={20} sx={{ marginLeft: '1rem' }} />
                    ) : (
                        <Link
                            onClick={handleCreateProject}
                            underline="hover"
                            sx={{ fontWeight: 'bold', cursor: 'pointer' }}
                        >
                            Click here to get started
                        </Link>
                    )}
                </Typography>
            ) : (
                <Box>
                    <Box sx={SearchBarStyles.searchContainer}>
                        <Paper sx={[SearchBarStyles.paper]} variant="outlined">
                            <InputBase
                                value={''}
                                onChange={(event) => {}}
                                placeholder="search for projects and meta-analyses"
                                sx={SearchBarStyles.textfield}
                            />
                        </Paper>
                        <Button
                            disableElevation
                            type="submit"
                            sx={{
                                borderTopLeftRadius: '0px',
                                borderBottomLeftRadius: '0px',
                                width: '150px',
                            }}
                            variant="contained"
                            startIcon={<SearchIcon />}
                        >
                            Search
                        </Button>
                        <Button
                            sx={{
                                borderTopLeftRadius: '0px',
                                borderBottomLeftRadius: '0px',
                                borderLeft: '0px !important',
                                width: '100px',
                            }}
                            disableElevation
                            variant="text"
                        >
                            Reset
                        </Button>
                    </Box>
                    <Box mt="1rem">
                        {(data || []).map((project, index) => (
                            <Box
                                key={project?.id || ''}
                                sx={{
                                    ':nth-child(2n)': {
                                        backgroundColor: '#f7f7f7',
                                        borderRadius: '4px',
                                    },
                                }}
                            >
                                <ProjectsPageCard {...project} />
                            </Box>
                        ))}
                    </Box>
                </Box>
            )}
        </StateHandlerComponent>
    );
};

export default ProjectsPage;
