import { Bookmark, CheckCircle, QuestionMark } from '@mui/icons-material';
import { Box, ListItemIcon, ListItemText, MenuItem, Select, SelectChangeEvent, Typography } from '@mui/material';
import { EExtractionStatus } from '../ExtractionPage';

const ExtractionStatusInput: React.FC<EExtractionStatus | undefined> = (props) => {
    switch (props) {
        case EExtractionStatus.COMPLETED:
            return (
                <Box display="flex" sx={{ overflow: 'hidden' }}>
                    <CheckCircle color="success" />
                    <Typography>Completed</Typography>
                </Box>
            );
        case EExtractionStatus.SAVEDFORLATER:
            return (
                <Box display="flex" sx={{ overflow: 'hidden' }}>
                    <CheckCircle color="primary" />
                    <Typography>Saved for Later</Typography>
                </Box>
            );
        case EExtractionStatus.UNCATEGORIZED:
            return (
                <Box display="flex" sx={{ overflow: 'hidden' }}>
                    <QuestionMark color="warning" />
                    <Typography>Unreviewed</Typography>
                </Box>
            );
        case undefined:
        default:
            return (
                <Box display="flex" sx={{ overflow: 'hidden' }}>
                    <Typography>All</Typography>
                </Box>
            );
    }
};

const ExtractionTableStatusFilter: React.FC<{
    value: EExtractionStatus | null;
    onChange: (val: string | null) => void;
}> = ({ value, onChange }) => {
    const handleOnChange = (event: SelectChangeEvent<EExtractionStatus | undefined>) => {
        onChange(event.target.value ? event.target.value : null);
    };

    return (
        <Box sx={{ width: '100%' }}>
            <Select
                size="small"
                sx={{ width: '100%' }}
                value={value || ''}
                displayEmpty
                onChange={handleOnChange}
                renderValue={ExtractionStatusInput}
            >
                <MenuItem value="">
                    <ListItemIcon></ListItemIcon>
                    <ListItemText>All</ListItemText>
                </MenuItem>
                <MenuItem value={EExtractionStatus.UNCATEGORIZED}>
                    <ListItemIcon>
                        <QuestionMark color="warning" />
                    </ListItemIcon>
                    <ListItemText>Unreviewed</ListItemText>
                </MenuItem>
                <MenuItem value={EExtractionStatus.SAVEDFORLATER}>
                    <ListItemIcon>
                        <Bookmark color="primary" />
                    </ListItemIcon>
                    <ListItemText>Saved for Later</ListItemText>
                </MenuItem>
                <MenuItem value={EExtractionStatus.COMPLETED}>
                    <ListItemIcon>
                        <CheckCircle color="success" />
                    </ListItemIcon>
                    <ListItemText>Completed</ListItemText>
                </MenuItem>
            </Select>
        </Box>
    );
};

export default ExtractionTableStatusFilter;
