import { Box, Typography, TableRow, TableCell } from '@mui/material';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import NeurosynthTable from 'components/Tables/NeurosynthTable/NeurosynthTable';
import NeurosynthTableStyles from 'components/Tables/NeurosynthTable/NeurosynthTable.styles';
import { useHistory } from 'react-router-dom';

const ProjectsPage: React.FC = (props) => {
    const history = useHistory();

    const myProjects = [
        {
            id: '1',
            name: 'My project',
            description: 'my project demo',
        },
    ];

    return (
        <StateHandlerComponent isLoading={false} isError={false}>
            <Box sx={{ marginBottom: '1rem' }}>
                <Typography variant="h4">My Projects</Typography>
            </Box>
            <Box>
                <NeurosynthTable
                    tableConfig={{
                        tableHeaderBackgroundColor: 'secondary.main',
                        isLoading: false,
                    }}
                    headerCells={[
                        {
                            text: 'Name',
                            key: 'name',
                            styles: { fontWeight: 'bold', color: 'primary.contrastText' },
                        },
                        {
                            text: 'Description',
                            key: 'description',
                            styles: { fontWeight: 'bold', color: 'primary.contrastText' },
                        },
                    ]}
                    rows={myProjects.map((project, index) => (
                        <TableRow
                            key={project.id}
                            onClick={() => history.push(`projects/${project.id}`)}
                            sx={NeurosynthTableStyles.tableRow}
                        >
                            <TableCell>{project.name}</TableCell>
                            <TableCell>{project.description}</TableCell>
                        </TableRow>
                    ))}
                />
            </Box>
        </StateHandlerComponent>
    );
};

export default ProjectsPage;
