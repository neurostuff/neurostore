import { Typography } from '@mui/material';
import { CellContext, HeaderContext } from '@tanstack/react-table';
import { StudyReturn } from 'neurostore-typescript-sdk';

export const ExtractionTableYearCell: React.FC<CellContext<StudyReturn, number>> = (props) => {
    const value = props.getValue();
    return <Typography variant="body2">{`${value}`}</Typography>;
};

export const ExtractionTableYearHeader: React.FC<HeaderContext<StudyReturn, number>> = (props) => {
    return <Typography>Year</Typography>;
};
