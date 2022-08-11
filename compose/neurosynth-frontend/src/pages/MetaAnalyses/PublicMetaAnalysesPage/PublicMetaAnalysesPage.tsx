import { Typography, Box, IconButton } from '@mui/material';
import { useHistory } from 'react-router-dom';
import DisplayValuesTable from 'components/Tables/DisplayValuesTable/DisplayValuesTable';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { IDisplayValuesTableModel } from 'components/Tables/DisplayValuesTable';
import { useGetMetaAnalyses } from 'hooks';
import useGetTour from 'hooks/useGetTour';
import Help from '@mui/icons-material/Help';

const PublicMetaAnalysesPage: React.FC = (props) => {
    const { startTour } = useGetTour('PublicMetaAnalysesPage');
    const history = useHistory();
    const { data, isLoading, isError } = useGetMetaAnalyses();

    const handleMetaAnalysisSelected = (selected: string | number) => {
        history.push(`/meta-analyses/${selected}`);
    };

    const metaAnalysesTableData: IDisplayValuesTableModel = {
        isLoading: isLoading,
        paper: true,
        selectable: true,
        onValueSelected: handleMetaAnalysisSelected,
        tableHeadRowColor: '#5C2751',
        tableHeadRowTextContrastColor: 'white',
        columnHeaders: [
            {
                value: 'Name',
            },
            {
                value: 'Description',
            },
            {
                value: 'User',
            },
        ],
        rowData: (data || []).map((metaAnalysis, index) => ({
            uniqueKey: metaAnalysis.id || index,
            columnValues: [
                {
                    value: metaAnalysis.name || 'no name',
                    shouldHighlightNoData: !metaAnalysis.name,
                },
                {
                    value: metaAnalysis.description || 'no description',
                    shouldHighlightNoData: !metaAnalysis.description,
                },
                {
                    value: metaAnalysis.user || 'no user',
                    shouldHighlightNoData: !metaAnalysis.user,
                },
            ],
        })),
    };

    return (
        <>
            <Box
                sx={{
                    display: 'flex',
                    marginBottom: '1rem',
                }}
            >
                <Typography variant="h4">Public Meta-Analyses</Typography>
                <IconButton onClick={() => startTour()}>
                    <Help color="primary" />
                </IconButton>
            </Box>

            <StateHandlerComponent
                isError={isError}
                isLoading={false}
                errorMessage="There was an error fetching meta-analyses"
            >
                <Box data-tour="PublicMetaAnalysesPage-1">
                    <DisplayValuesTable {...metaAnalysesTableData} />
                </Box>
            </StateHandlerComponent>
        </>
    );
};

export default PublicMetaAnalysesPage;
