import { HelpOutline } from '@mui/icons-material';
import { Box, Icon, Paper, Tooltip, Typography } from '@mui/material';
import { useMemo } from 'react';
import { parseNimareFileName } from '../Nimare.helpers';

const DisplayParsedNiMareFile: React.FC<{ nimareFileName: string | undefined | null }> = (props) => {
    const fileNameSegments = useMemo(() => {
        return parseNimareFileName(props.nimareFileName);
    }, [props.nimareFileName]);

    return (
        <Box display="flex" flexWrap="wrap">
            {fileNameSegments.map((segment) => (
                <Paper
                    key={segment.key}
                    component={Box}
                    variant="elevation"
                    display="flex"
                    flexDirection="column"
                    width="15%"
                    marginRight="2%"
                    marginBottom="0.5rem"
                    padding="0.5rem"
                    elevation={1}
                >
                    <Box display="flex" alignItems="center">
                        <Typography color="muted.main" gutterBottom={false} variant="caption" marginRight="4px">
                            {segment.key}
                        </Typography>
                        <Tooltip title={<Typography variant="caption">{segment.keyDesc}</Typography>} placement="top">
                            <Icon fontSize="small">
                                <HelpOutline fontSize="small" sx={{ color: 'muted.main' }} />
                            </Icon>
                        </Tooltip>
                    </Box>
                    <Typography variant="body2">{segment.value}</Typography>
                </Paper>
            ))}
        </Box>
    );
};

export default DisplayParsedNiMareFile;
