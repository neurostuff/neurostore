import { Box, Typography } from '@mui/material';
import { IDynamicInputType, KWARG_STRING } from '../..';

const DynamicInputDisplay: React.FC<{ dynamicArg: IDynamicInputType }> = (props) => {
    const valuesList = Object.keys(props.dynamicArg)
        .filter((x) => !!props.dynamicArg[x])
        .sort();
    const kwargStringIndex = valuesList.findIndex((spec) => spec === KWARG_STRING);
    if (kwargStringIndex >= 0) valuesList.splice(kwargStringIndex, 1);

    const kwargs = (props.dynamicArg[KWARG_STRING] || {}) as { [key: string]: string };
    const kwargList = Object.keys(kwargs || {});

    return (
        <>
            {valuesList.length > 0 && (
                <>
                    <Typography sx={{ marginTop: '1rem', fontWeight: 'bold' }}>
                        Optional arguments
                    </Typography>
                    <Box
                        sx={{
                            display: 'block',
                            borderCollapse: 'separate',
                            borderSpacing: '20px 0px',
                            marginLeft: '-20px',
                        }}
                    >
                        {valuesList.map((value) => (
                            <Box key={value} sx={{ display: 'table-row' }}>
                                <Box sx={{ display: 'table-cell' }}>{value}</Box>
                                <Box sx={{ display: 'table-cell' }}>{props.dynamicArg[value]}</Box>
                            </Box>
                        ))}
                    </Box>
                </>
            )}

            {Object.keys(kwargs).length > 0 && (
                <>
                    <Typography sx={{ marginTop: '1rem', fontWeight: 'bold' }}>
                        {KWARG_STRING}
                    </Typography>
                    <Box
                        sx={{
                            display: 'block',
                            borderCollapse: 'separate',
                            borderSpacing: '20px 0px',
                            marginLeft: '-20px',
                        }}
                    >
                        {kwargList.map((value) => (
                            <Box key={value} sx={{ display: 'table-row' }}>
                                <Box sx={{ display: 'table-cell' }}>{value}</Box>
                                <Box sx={{ display: 'table-cell' }}>{kwargs[value]}</Box>
                            </Box>
                        ))}
                    </Box>
                </>
            )}
        </>
    );
};

export default DynamicInputDisplay;
