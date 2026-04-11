import { Box, Card, CardContent, CircularProgress, Tooltip, Typography } from '@mui/material';
import { useGetExtractionSummary } from 'hooks';
import { useProjectId } from 'pages/Project/store/ProjectStore';
import DisplayExtractionTableState from 'pages/StudyCBMA/components/DisplayExtractionTableState';
import { type FC, useMemo } from 'react';

const statusSize = 80;

const EditStudyStatusCard: FC = () => {
    const projectId = useProjectId();
    const extractionSummary = useGetExtractionSummary(projectId || '');

    const percentageCompleteString = useMemo((): string => {
        if (extractionSummary.total === 0) return '0 / 0';
        return `${extractionSummary.completed} / ${extractionSummary.total}`;
    }, [extractionSummary.completed, extractionSummary.total]);

    const percentageComplete = useMemo((): number => {
        if (extractionSummary.total === 0) return 0;
        const pct = (extractionSummary.completed / extractionSummary.total) * 100;
        return Math.floor(pct);
    }, [extractionSummary.completed, extractionSummary.total]);

    const isComplete = useMemo(() => {
        return extractionSummary.completed === extractionSummary.total && extractionSummary.total > 0;
    }, [extractionSummary.completed, extractionSummary.total]);

    const ringSize = statusSize - 10;

    return (
        <Card elevation={1}>
            <CardContent
                sx={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-around',
                    alignItems: 'center',
                    boxSizing: 'border-box',
                    padding: '0.5rem !important',
                }}
            >
                <Typography gutterBottom>Extraction progress</Typography>
                <Box
                    sx={{
                        width: statusSize,
                        height: statusSize,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        flexShrink: 0,
                    }}
                >
                    <Tooltip title={`${percentageCompleteString} studies marked as complete`} placement="left">
                        <Box sx={{ position: 'relative', width: ringSize, height: ringSize }}>
                            <Box
                                sx={{
                                    position: 'absolute',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1rem',
                                    fontWeight: 600,
                                    zIndex: 1,
                                    width: ringSize,
                                    height: ringSize,
                                    color: isComplete ? 'success.main' : 'primary.main',
                                }}
                            >
                                {percentageComplete}%
                            </Box>
                            <CircularProgress
                                sx={{
                                    backgroundColor: '#ededed',
                                    borderRadius: '50%',
                                    width: ringSize,
                                    height: ringSize,
                                }}
                                color={isComplete ? 'success' : 'primary'}
                                variant="determinate"
                                value={percentageComplete}
                                size={ringSize}
                                thickness={5}
                            />
                        </Box>
                    </Tooltip>
                </Box>
                <Box
                    sx={{
                        minWidth: '320px',
                        boxSizing: 'border-box',
                        width: '100%',
                        padding: '1rem',
                        display: 'flex',
                        justifyContent: 'flex-end',
                    }}
                >
                    <DisplayExtractionTableState />
                </Box>
            </CardContent>
        </Card>
    );
};

export default EditStudyStatusCard;
