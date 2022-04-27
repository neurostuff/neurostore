import { Box, Typography, Divider } from '@mui/material';
import MetaAnalysisSummaryRowStyles from './MetaAnalysisSummaryRow.styles';

interface IMetaAnalysisSummaryRow {
    title: string;
    value: string;
    caption?: string;
    divider: boolean;
}

const MetaAnalysisSummaryRow: React.FC<IMetaAnalysisSummaryRow> = (props) => {
    return (
        <>
            <Box sx={{ display: 'flex' }}>
                <Box sx={MetaAnalysisSummaryRowStyles.titleColWidth}>
                    <Typography sx={{ color: 'primary.main' }} variant="h6">
                        {props.title}
                    </Typography>
                </Box>
                <Box>
                    <Typography variant="h6">{props.value}</Typography>
                    <Typography variant="body1" sx={{ color: 'gray' }}>
                        {props.caption || ''}
                    </Typography>
                </Box>
            </Box>
            <Box sx={MetaAnalysisSummaryRowStyles.dynamicInput}>{props.children}</Box>
            {props.divider && <Divider sx={MetaAnalysisSummaryRowStyles.divider} />}
        </>
    );
};

export default MetaAnalysisSummaryRow;
