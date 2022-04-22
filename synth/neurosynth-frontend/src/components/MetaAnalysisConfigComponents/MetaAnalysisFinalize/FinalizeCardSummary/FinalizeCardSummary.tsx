import { Box, Typography, Card, CardHeader, CardContent } from '@mui/material';
import { SystemStyleObject } from '@mui/system';

interface IFinalizeCardSummary {
    cardTitle: string;
    label: string;
    description: string;
    sx?: SystemStyleObject;
}

const FinalizeCardSummary: React.FC<IFinalizeCardSummary> = (props) => {
    return (
        <Box sx={{ ...(props.sx || {}) }} component={Card} variant="outlined">
            <CardHeader
                sx={{ backgroundColor: 'primary.main', color: 'primary.contrastText' }}
                title={props.cardTitle}
            />
            <CardContent>
                <Typography sx={{ fontWeight: 'bold' }} variant="h6">
                    {props.label}
                </Typography>
                <Typography sx={{ color: 'gray' }}>{props.description}</Typography>
                {props.children && <Box sx={{ marginTop: '1rem' }}>{props.children}</Box>}
            </CardContent>
        </Box>
    );
};

export default FinalizeCardSummary;
