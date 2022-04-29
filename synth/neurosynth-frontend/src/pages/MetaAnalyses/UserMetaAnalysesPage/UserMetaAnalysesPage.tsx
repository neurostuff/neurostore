import { Button, Typography, Box } from '@mui/material';
import { useHistory } from 'react-router-dom';
import { DisplayValuesTable, IDisplayValuesTableModel } from '../../../components';
import { useGetMetaAnalyses } from '../../../hooks';

const UserMetaAnalysesPage: React.FC = (props) => {
    const history = useHistory();
    const { data, isLoading, isError, error } = useGetMetaAnalyses();

    const metaAnalysesTableData: IDisplayValuesTableModel = {
        isLoading: isLoading,
        paper: true,
        tableHeadRowColor: '#5C2751',
        tableHeadRowTextContrastColor: 'white',
        columnHeaders: [
            {
                value: 'Name',
            },
            {
                value: 'Description',
            },
        ],
        rowData: [],
    };

    return (
        <>
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '1rem',
                }}
            >
                <Typography variant="h4">My Meta-Analyses</Typography>

                <Button
                    variant="contained"
                    onClick={() => history.push('/meta-analyses/build')}
                    color="primary"
                >
                    Create new meta-analysis
                </Button>
            </Box>

            <DisplayValuesTable {...metaAnalysesTableData} />
        </>
    );
};

export default UserMetaAnalysesPage;
