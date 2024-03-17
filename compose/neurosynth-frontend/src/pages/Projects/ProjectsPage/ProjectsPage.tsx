import { useAuth0 } from '@auth0/auth0-react';
import {
    Box,
    Input,
    InputBase,
    InputLabel,
    Link,
    Paper,
    TableCell,
    TableRow,
    Typography,
} from '@mui/material';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import NeurosynthTable from 'components/Tables/NeurosynthTable/NeurosynthTable';
import NeurosynthTableStyles from 'components/Tables/NeurosynthTable/NeurosynthTable.styles';
import useGetProjects, { INeurosynthProjectReturn } from 'hooks/projects/useGetProjects';
import { useIsMutating } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { generateNewProjectData } from '../ProjectPage/ProjectStore.helpers';
import { useCreateProject, useGuard } from 'hooks';
import ProgressLoader from 'components/ProgressLoader/ProgressLoader';
import ProjectsPageCard from './ProjectsPageCard';
import SearchBarStyles from 'components/Search/SearchBar/SearchBar.styles';

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
        <StateHandlerComponent isLoading={false} isError={isError}>
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
                <>
                    <Paper sx={SearchBarStyles.paper} variant="outlined">
                        <InputBase
                            value={''}
                            onChange={(event) => {}}
                            placeholder="search for projects and meta-analyses"
                            sx={SearchBarStyles.textfield}
                        />
                    </Paper>
                    <Box mt="1rem">
                        {(data || []).map((project, index) => (
                            <ProjectsPageCard key={project?.id || ''} {...project} />
                        ))}
                    </Box>
                </>
                // <NeurosynthTable
                //     tableConfig={{
                //         isLoading: getProjectsIsLoading || isFetching || createProjectIsFetching,
                //         loaderColor: 'secondary',
                //         tableHeaderBackgroundColor: 'secondary.main',
                //         noDataDisplay: (
                //             <Box sx={{ color: 'warning.dark', padding: '1rem' }}>
                //                 No projects found
                //             </Box>
                //         ),
                //     }}
                //     headerCells={[
                //         {
                //             text: 'Name',
                //             key: 'name',
                //             styles: { color: 'primary.contrastText', fontWeight: 'bold' },
                //         },
                //         {
                //             text: 'Description',
                //             key: 'description',
                //             styles: { color: 'primary.contrastText', fontWeight: 'bold' },
                //         },
                //     ]}
                //     rows={(data || []).map((project, index) => (
                //         <TableRow
                //             data-tour={index === 0 ? 'StudiesPage-4' : null}
                //             sx={NeurosynthTableStyles.tableRow}
                //             key={project?.id || index}
                //             onClick={() => handleSelectProject(project)}
                //         >
                //             <TableCell>
                //                 {project?.name || <Box sx={{ color: 'warning.dark' }}>No name</Box>}
                //             </TableCell>
                //             <TableCell>
                //                 {project?.description || (
                //                     <Box sx={{ color: 'warning.dark' }}>No description</Box>
                //                 )}
                //             </TableCell>
                //         </TableRow>
                //     ))}
                // />
            )}
        </StateHandlerComponent>
    );
};

export default ProjectsPage;
