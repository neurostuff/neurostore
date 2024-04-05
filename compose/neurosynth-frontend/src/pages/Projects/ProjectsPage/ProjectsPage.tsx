import { useAuth0 } from '@auth0/auth0-react';
import { Box, Typography } from '@mui/material';
import SearchContainer from 'components/Search/SearchContainer/SearchContainer';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useGuard } from 'hooks';
import { INeurosynthProjectReturn } from 'hooks/projects/useGetProjects';
import ProjectsPageCard from '../../../components/ProjectsPageComponents/ProjectsPageCard';
import useSearchProjects from './useSearchProjects';

const ProjectsPage: React.FC = (props) => {
    const { isAuthenticated } = useAuth0();
    useGuard('/', 'Please log in', !isAuthenticated);

    const {
        handlePageChange,
        handleRowsPerPageChange,
        handleSearch,
        isError,
        isLoading,
        projects,
    } = useSearchProjects();

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
                totalCount={projects?.results?.length || 0}
                pageSize={10}
                pageOfResults={1}
            >
                <StateHandlerComponent isLoading={isLoading} isError={isError}>
                    {(projects?.results || []).map((project) => (
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

// {/* {noProjects ? (
//     <Typography>
//         You haven't created a project yet.{' '}
//         {createProjectIsLoading ? (
//             <ProgressLoader size={20} sx={{ marginLeft: '1rem' }} />
//         ) : (
//             <Link
//                 onClick={handleCreateProject}
//                 underline="hover"
//                 sx={{ fontWeight: 'bold', cursor: 'pointer' }}
//             >
//                 Click here to get started
//             </Link>
//         )}
//     </Typography>
// ) : (
//     <Box>
//         <Box sx={SearchBarStyles.searchContainer}>
//             <Paper sx={[SearchBarStyles.paper]} variant="outlined">
//                 <InputBase
//                     value={''}
//                     onChange={(event) => {}}
//                     placeholder="search for projects and meta-analyses"
//                     sx={SearchBarStyles.textfield}
//                 />
//             </Paper>
//             <Button
//                 disableElevation
//                 type="submit"
//                 sx={{
//                     borderTopLeftRadius: '0px',
//                     borderBottomLeftRadius: '0px',
//                     width: '150px',
//                 }}
//                 variant="contained"
//                 startIcon={<SearchIcon />}
//             >
//                 Search
//             </Button>
//             <Button
//                 sx={{
//                     borderTopLeftRadius: '0px',
//                     borderBottomLeftRadius: '0px',
//                     borderLeft: '0px !important',
//                     width: '100px',
//                 }}
//                 disableElevation
//                 variant="text"
//             >
//                 Reset
//             </Button>
//         </Box>
//         <Box>
//             <Pagination
//                 sx={{ marginTop: '1rem', width: '100%' }}
//                 count={data?.length || 0}
//             />
//         </Box>
//         <Box mt="1rem">
//             {(data || []).map((project, index) => (
//                 <Box
//                     key={project?.id || ''}
//                     sx={{
//                         ':nth-of-type(2n)': {
//                             backgroundColor: '#f7f7f7',
//                             borderRadius: '4px',
//                         },
//                     }}
//                 >
//                     <ProjectsPageCard {...project} />
//                 </Box>
//             ))}
//         </Box> */}
// {/* </Box> */}
// {/* )} */}
