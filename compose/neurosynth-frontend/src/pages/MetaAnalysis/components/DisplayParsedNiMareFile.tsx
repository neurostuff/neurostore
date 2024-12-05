import { HelpOutline } from '@mui/icons-material';
import { Box, Icon, Paper, Tooltip, Typography } from '@mui/material';
import { useMemo } from 'react';

const nimareOutputs = {
    // possible value types
    z: 'Z-statistic',
    t: 'T-statistic',
    p: 'p-value',
    logp: 'Negative base-ten logarithm of p-value',
    chi2: 'Chi-squared value',
    prob: 'Probability value',
    stat: 'Test value of meta-analytic algorithm (e.g., ALE values for ALE, OF values for MKDA)',
    est: 'Parameter estimate (IBMA only)',
    se: 'Standard error of the parameter estimate (IBMA only)',
    tau2: 'Estimated between-study variance (IBMA only)',
    sigma2: 'Estimated within-study variance (IBMA only)',
    label: 'Label map',
    // methods of meta analysis
    desc: 'Description of the data type. Only used when multiple maps with the same data type are produced by the same method.',
    level: 'Level of multiple comparisons correction. Either cluster or voxel.',
    corr: 'Type of multiple comparisons correction. Either FWE (familywise error rate) or FDR (false discovery rate).',
    method: 'Name of the method used for multiple comparisons correction (e.g., “montecarlo” for a Monte Carlo procedure).',
    diag: 'Type of diagnostic. Either Jackknife (jackknife analysis) or FocusCounter (focus-count analysis).',
    tab: 'Type of table. Either clust (clusters table) or counts (contribution table).',
    tail: 'Sign of the tail for label maps. Either positive or negative.',
};

const parseSegment = (segment: string): { key: string; keyDesc: string; value: string } => {
    const [key, value] = segment.split('-');
    if (value === undefined) {
        // not a method
        return {
            key: 'type',
            keyDesc: 'The type of data in the map.',
            value: `${nimareOutputs[key as keyof typeof nimareOutputs]}`,
        };
    } else {
        return {
            key: key,
            keyDesc: nimareOutputs[key as keyof typeof nimareOutputs],
            value: value,
        };
    }
};

const DisplayParsedNiMareFile: React.FC<{ nimareFileName: string | undefined }> = (props) => {
    const fileNameSegments = useMemo(() => {
        if (!props.nimareFileName) return [];
        const segments = props.nimareFileName.replace('.nii.gz', '').split('_');
        return segments.map(parseSegment);
    }, [props.nimareFileName]);

    return (
        <Box display="flex" flexWrap="wrap" justifyContent="space-between">
            {fileNameSegments.map((segment) => (
                <Paper
                    key={segment.key}
                    component={Box}
                    variant="elevation"
                    display="flex"
                    flexDirection="column"
                    width="30%"
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
