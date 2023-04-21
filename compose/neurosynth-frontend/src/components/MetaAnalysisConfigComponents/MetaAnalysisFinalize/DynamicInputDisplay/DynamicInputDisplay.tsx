import { Box, Typography } from '@mui/material';
import { IDynamicValueType, KWARG_STRING } from '../..';
import DynamicInputDisplayStyles from './DynamicInputDisplay.styles';

const DynamicInputDisplay: React.FC<{ dynamicArg: IDynamicValueType }> = (props) => {
    /**
     * filter for values that exist
     */
    const valuesList = Object.keys(props.dynamicArg)
        .filter((x) => !!props.dynamicArg[x])
        .sort();

    /**
     * if kwarg string exists, remove it and put it into its own object and list
     */
    const kwargStringIndex = valuesList.findIndex((spec) => spec === KWARG_STRING);
    if (kwargStringIndex >= 0) valuesList.splice(kwargStringIndex, 1);
    const kwargs = (props.dynamicArg[KWARG_STRING] || {}) as { [key: string]: string };
    const kwargList = Object.keys(kwargs);

    return (
        <>
            {valuesList.length > 0 && (
                <>
                    <Typography sx={DynamicInputDisplayStyles.dynamicInputSection}>
                        Optional arguments
                    </Typography>
                    <Box sx={DynamicInputDisplayStyles.valuesListContainer}>
                        {valuesList.map((value) => (
                            <Box key={value} sx={DynamicInputDisplayStyles.tr}>
                                <Box sx={DynamicInputDisplayStyles.cell}>{value}</Box>:
                                <Box sx={DynamicInputDisplayStyles.cell}>
                                    {`${props.dynamicArg[value]}`}
                                </Box>
                            </Box>
                        ))}
                    </Box>
                </>
            )}

            {Object.keys(kwargs).length > 0 && (
                <>
                    <Typography sx={DynamicInputDisplayStyles.dynamicInputSection}>
                        {KWARG_STRING}
                    </Typography>
                    <Box sx={DynamicInputDisplayStyles.valuesListContainer}>
                        {kwargList.map((value) => (
                            <Box key={value} sx={DynamicInputDisplayStyles.tr}>
                                <Box sx={DynamicInputDisplayStyles.cell}>{value}</Box>:
                                <Box sx={DynamicInputDisplayStyles.cell}>{`${kwargs[value]}`}</Box>
                            </Box>
                        ))}
                    </Box>
                </>
            )}
        </>
    );
};

export default DynamicInputDisplay;
