import { Box, Typography } from '@mui/material';
import { CellContext, HeaderContext } from '@tanstack/react-table';
import { StudyReturn } from 'neurostore-typescript-sdk';

export const ExtractionTableNameCell: React.FC<CellContext<StudyReturn, string>> = (props) => {
    const value = props.getValue();
    return (
        <Typography variant="body2" fontWeight="bold">
            {value}
        </Typography>
    );
};

export const ExtractionTableNameHeader: React.FC<HeaderContext<StudyReturn, string>> = (props) => {
    return <Typography>Name</Typography>;
};
