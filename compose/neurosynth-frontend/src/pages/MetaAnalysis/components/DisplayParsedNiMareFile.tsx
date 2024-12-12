import { HelpOutline } from '@mui/icons-material';
import { Box, Icon, Paper, Tooltip, Typography } from '@mui/material';
import { useMemo } from 'react';

// must turn this into an array to make it orderable
export const NimareOutputs = [
    // possible value types
    { type: 'z', isValueType: true, description: 'Z-statistic' },
    { type: 't', isValueType: true, description: 'T-statistic' },
    { type: 'p', isValueType: true, description: 'p-value' },
    { type: 'logp', isValueType: true, description: 'Negative base-ten logarithm of p-value' },
    { type: 'chi2', isValueType: true, description: 'Chi-squared value' },
    { type: 'prob', isValueType: true, description: 'Probability value' },
    {
        type: 'stat',
        isValueType: true,
        description: 'Test value of meta-analytic algorithm (e.g., ALE values for ALE, OF values for MKDA)',
    },
    { type: 'est', isValueType: true, description: 'Parameter estimate (IBMA only)' },
    { type: 'se', isValueType: true, description: 'Standard error of the parameter estimate (IBMA only)' },
    { type: 'tau2', isValueType: true, description: 'Estimated between-study variance (IBMA only)' },
    { type: 'sigma2', isValueType: true, description: 'Estimated within-study variance (IBMA only)' },
    { type: 'label', isValueType: true, description: 'Label map' },
    // methods of meta analysis
    {
        type: 'desc',
        isValueType: false,
        description:
            'Description of the data type. Only used when multiple maps with the same data type are produced by the same method.',
    },
    {
        type: 'level',
        isValueType: false,
        description: 'Level of multiple comparisons correction. Either cluster or voxel.',
    },
    {
        type: 'corr',
        isValueType: false,
        description:
            'Type of multiple comparisons correction. Either FWE (familywise error rate) or FDR (false discovery rate).',
    },
    {
        type: 'method',
        isValueType: false,
        description:
            'Name of the method used for multiple comparisons correction (e.g., “montecarlo” for a Monte Carlo procedure).',
    },
    {
        type: 'diag',
        isValueType: false,
        description:
            'Type of diagnostic. Either Jackknife (jackknife analysis) or FocusCounter (focus-count analysis).',
    },
    {
        type: 'tab',
        isValueType: false,
        description: 'Type of table. Either clust (clusters table) or counts (contribution table).',
    },
    { type: 'tail', isValueType: false, description: 'Sign of the tail for label maps. Either positive or negative.' },
];

export const parseNimareFileName = (fileName: string | undefined) => {
    if (!fileName) return [];
    const segments = fileName.replace('.nii.gz', '').split('_');
    return segments.map((segment) => {
        const [key, value] = segment.split('-');
        const nimareOutput = NimareOutputs.find((output) => output.type === key);
        if (value === undefined) {
            // not a method
            return {
                key: 'type',
                isValueType: nimareOutput?.isValueType || false,
                keyDesc: 'The type of data in the map.',
                value: nimareOutput?.type || '',
            };
        } else {
            return {
                key: key,
                isValueType: nimareOutput?.isValueType || false,
                keyDesc: nimareOutput?.description || '',
                value: value,
            };
        }
    });
};

const DisplayParsedNiMareFile: React.FC<{ nimareFileName: string | undefined }> = (props) => {
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
                    width="29%"
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
