import { Typography, Box } from '@mui/material';
import { useHistory } from 'react-router-dom';
import { DisplayValuesTable, StateHandlerComponent } from 'components';
import { IDisplayValuesTableModel } from 'components/Tables/DisplayValuesTable';
import { useGetMetaAnalyses } from 'hooks';

const PublicMetaAnalysesPage: React.FC = (props) => {
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
                    justifyContent: 'space-between',
                    marginBottom: '1rem',
                }}
            >
                <Typography variant="h4">Public Meta-Analyses</Typography>
            </Box>

            <StateHandlerComponent
                isError={isError}
                isLoading={false}
                errorMessage="There was an error fetching meta-analyses"
            >
                <DisplayValuesTable {...metaAnalysesTableData} />
            </StateHandlerComponent>
        </>
    );
};

export default PublicMetaAnalysesPage;
