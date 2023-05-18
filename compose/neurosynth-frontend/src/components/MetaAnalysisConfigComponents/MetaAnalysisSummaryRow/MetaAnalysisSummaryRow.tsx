import { Box, Typography } from '@mui/material';
import MetaAnalysisSummaryRowStyles from './MetaAnalysisSummaryRow.styles';

interface IMetaAnalysisSummaryRow {
    title: string | JSX.Element;
    value: string | JSX.Element;
    caption?: string | JSX.Element;
}

const MetaAnalysisSummaryRow: React.FC<IMetaAnalysisSummaryRow> = (props) => {
    return (
        <Box sx={{ marginBottom: '1.5rem', width: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Box sx={MetaAnalysisSummaryRowStyles.colWidth}>
                    <Typography sx={{ color: 'primary.main', fontWeight: 'bold' }} variant="h6">
                        {props.title}
                    </Typography>
                </Box>
                <Box sx={MetaAnalysisSummaryRowStyles.colWidth}>
                    <Typography variant="h6">{props.value}</Typography>
                    <Typography variant="body1" sx={{ color: 'gray' }}>
                        {props.caption || ''}
                    </Typography>
                </Box>
            </Box>
            <Box sx={MetaAnalysisSummaryRowStyles.dynamicInput}>{props.children}</Box>
        </Box>
    );
};

export default MetaAnalysisSummaryRow;
