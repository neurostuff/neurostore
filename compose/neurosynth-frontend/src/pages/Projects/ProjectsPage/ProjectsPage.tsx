import { Box, IconButton, Typography, TableRow, TableCell } from '@mui/material';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import HelpIcon from '@mui/icons-material/Help';
import NeurosynthTable from 'components/Tables/NeurosynthTable/NeurosynthTable';
import useGetProjects from 'hooks/requests/useGetProjects';
import NeurosynthTableStyles from 'components/Tables/NeurosynthTable/NeurosynthTable.styles';
import { useHistory } from 'react-router-dom';
import { useIsMutating } from 'react-query';
import { useAuth0 } from '@auth0/auth0-react';

const ProjectsPage: React.FC = (props) => {
    const { user, isAuthenticated } = useAuth0();
    const { data, isError, isLoading, isFetching } = useGetProjects(isAuthenticated, user?.sub);
    const createProjectIsFetchingNum = useIsMutating('create-project');
    const history = useHistory();

    const createProjectIsFetching = createProjectIsFetchingNum > 0;

    return (
        <StateHandlerComponent isLoading={false} isError={isError}>
            <Box sx={{ display: 'flex' }}>
                <Typography gutterBottom variant="h4">
                    Projects
                </Typography>
                <IconButton onClick={() => {}} color="primary">
                    <HelpIcon />
                </IconButton>
            </Box>

            <NeurosynthTable
                tableConfig={{
                    isLoading: isLoading || isFetching || createProjectIsFetching,
                    loaderColor: 'secondary',
                    tableHeaderBackgroundColor: 'secondary.main',
                    noDataDisplay: (
                        <Box sx={{ color: 'warning.dark', padding: '1rem' }}>No projects found</Box>
                    ),
                }}
                headerCells={[
                    {
                        text: 'Name',
                        key: 'name',
                        styles: { color: 'primary.contrastText', fontWeight: 'bold' },
                    },
                    {
                        text: 'Description',
                        key: 'description',
                        styles: { color: 'primary.contrastText', fontWeight: 'bold' },
                    },
                ]}
                rows={(data || []).map((project, index) => (
                    <TableRow
                        data-tour={index === 0 ? 'StudiesPage-4' : null}
                        sx={NeurosynthTableStyles.tableRow}
                        key={project?.id || index}
                        onClick={() => history.push(`/projects/${project?.id}`)}
                    >
                        <TableCell>
                            {project?.name || <Box sx={{ color: 'warning.dark' }}>No name</Box>}
                        </TableCell>
                        <TableCell>
                            {project?.description || (
                                <Box sx={{ color: 'warning.dark' }}>No description</Box>
                            )}
                        </TableCell>
                    </TableRow>
                ))}
            />
        </StateHandlerComponent>
    );
};

export default ProjectsPage;
