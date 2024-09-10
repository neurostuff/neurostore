import { Box, Typography } from '@mui/material';
import { CellContext, HeaderContext } from '@tanstack/react-table';
import { StudyReturn } from 'neurostore-typescript-sdk';

export const ExtractionTableAuthorCell: React.FC<CellContext<StudyReturn, string>> = (props) => {
    const value = props.getValue();
    return <Typography variant="body2">{value}</Typography>;
};

export const ExtractionTableAuthorHeader: React.FC<HeaderContext<StudyReturn, string>> = (
    props
) => {
    return <Typography>Authors</Typography>;
};
