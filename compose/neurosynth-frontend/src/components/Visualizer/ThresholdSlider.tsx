import { Box, Slider, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';

const ThresholdSlider: React.FC<{
    onDebouncedThresholdChange: (update: {
        thresholdValue: number;
        thresholdMin: number;
        thresholdMax: number;
    }) => void;
    thresholdMin: number;
    thresholdMax: number;
    threshold: number;
}> = ({ threshold, thresholdMin, thresholdMax, onDebouncedThresholdChange }) => {
    // These just hold the values for the various inputs, the actual threshold value may differ as it debounces changes
    const [thresholdInputs, setThresholdInputs] = useState<{
        thresholdMin: string;
        thresholdMax: string;
        sliderThreshold: number;
        inputThreshold: string;
    }>({
        thresholdMin: thresholdMin.toString(),
        thresholdMax: thresholdMax.toString(),
        sliderThreshold: threshold,
        inputThreshold: threshold.toString(),
    });

    useEffect(() => {
        setThresholdInputs((prev) => ({
            ...prev,
            thresholdMin: thresholdMin.toString(),
        }));
    }, [thresholdMin]);

    useEffect(() => {
        setThresholdInputs((prev) => ({
            ...prev,
            thresholdMax: thresholdMax.toString(),
        }));
    }, [thresholdMax]);

    useEffect(() => {
        setThresholdInputs((prev) => ({
            ...prev,
            sliderThreshold: threshold,
            inputThreshold: threshold.toString(),
        }));
    }, [threshold]);

    // debounced threshold min and max
    useEffect(() => {
        const debounce = setTimeout(() => {
            const parsedthresholdMin = parseFloat(thresholdInputs.thresholdMin);
            const parsedthresholdMax = parseFloat(thresholdInputs.thresholdMax);

            if (isNaN(parsedthresholdMin) || isNaN(parsedthresholdMax)) return;
            if (parsedthresholdMin >= parsedthresholdMax) return;
            if (parsedthresholdMin < 0) return;
            if (parsedthresholdMin === thresholdMin && parsedthresholdMax === thresholdMax) return; // no change

            onDebouncedThresholdChange({
                thresholdValue:
                    threshold < parsedthresholdMin
                        ? parsedthresholdMin
                        : threshold > parsedthresholdMax
                          ? parsedthresholdMax
                          : threshold,
                thresholdMin: parsedthresholdMin,
                thresholdMax: parsedthresholdMax,
            });
        });

        return () => {
            clearTimeout(debounce);
        };
    }, [onDebouncedThresholdChange, thresholdInputs.thresholdMax, thresholdInputs.thresholdMin]);

    // debounced input threshold value
    useEffect(() => {
        const debounce = setTimeout(() => {
            const parsedThreshold = parseFloat(thresholdInputs.inputThreshold);
            if (isNaN(parsedThreshold)) return;
            if (parsedThreshold === threshold) return;
            if (parsedThreshold < 0) return;
            if (parsedThreshold > thresholdMax) return;

            onDebouncedThresholdChange({
                thresholdValue: parsedThreshold,
                thresholdMin,
                thresholdMax,
            });
            setThresholdInputs((prev) => ({
                ...prev,
                sliderThreshold: parsedThreshold,
            }));
        }, 50);

        return () => {
            clearTimeout(debounce);
        };
    }, [thresholdInputs.inputThreshold, threshold, thresholdMin, thresholdMax, onDebouncedThresholdChange]);

    // debounced slider threshold value
    useEffect(() => {
        const debounce = setTimeout(() => {
            const newThreshold = thresholdInputs.sliderThreshold;
            if (newThreshold === threshold) return;
            if (newThreshold < 0) return;
            if (newThreshold > thresholdMax) return;

            onDebouncedThresholdChange({
                thresholdValue: newThreshold,
                thresholdMin,
                thresholdMax,
            });
            setThresholdInputs((prev) => ({
                ...prev,
                inputThreshold: newThreshold.toString(),
            }));
        }, 50);

        return () => {
            clearTimeout(debounce);
        };
    }, [thresholdInputs.sliderThreshold, threshold, thresholdMin, thresholdMax, onDebouncedThresholdChange]);

    const hasThresholdValueError =
        thresholdInputs.thresholdMin !== '' &&
        thresholdInputs.thresholdMax !== '' &&
        parseFloat(thresholdInputs.thresholdMin) >= parseFloat(thresholdInputs.thresholdMax);
    const hasThresholdMinEmptyError = thresholdInputs.thresholdMin === '';
    const hasThresholdMaxEmptyError = thresholdInputs.thresholdMax === '';

    const hasMinMaxError = hasThresholdValueError || hasThresholdMinEmptyError || hasThresholdMaxEmptyError;

    const hasThresholdInputEmptyError = thresholdInputs.inputThreshold === '';
    const parsedThresholdValue = parseFloat(thresholdInputs.inputThreshold);
    const hasThresholdInputValueError =
        thresholdInputs.inputThreshold !== '' &&
        (parsedThresholdValue > thresholdMax || parsedThresholdValue < thresholdMin);
    const hasThresholdError = hasThresholdInputEmptyError || hasThresholdInputValueError;

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="caption" gutterBottom={false}>
                    Threshold
                </Typography>
                <TextField
                    size="small"
                    type="number"
                    sx={{
                        width: '70px',
                        marginLeft: '0.5rem',
                        '.MuiOutlinedInput-input': {
                            padding: '4px',
                            fontSize: '14px',
                        },
                    }}
                    value={thresholdInputs.inputThreshold}
                    onChange={(event) => {
                        setThresholdInputs((prev) => ({
                            ...prev,
                            inputThreshold: event.target.value,
                        }));
                    }}
                    error={hasThresholdError}
                    variant="outlined"
                />
            </Box>
            <Box>
                <Slider
                    sx={{ paddingTop: '20px', paddingBottom: '0px' }}
                    valueLabelDisplay="auto"
                    min={thresholdMin}
                    step={0.001}
                    max={thresholdMax}
                    value={thresholdInputs.sliderThreshold}
                    onChange={(_event, newValue) => {
                        setThresholdInputs((prev) => ({
                            ...prev,
                            sliderThreshold: newValue as number,
                        }));
                    }}
                ></Slider>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {/* <TextField
                        sx={{
                            width: '60px',
                            '.MuiOutlinedInput-input': {
                                padding: '4px',
                                fontSize: '14px',
                            },
                        }}
                        type="number"
                        onChange={(event) => {
                            setThresholdInputs((prev) => ({
                                ...prev,
                                thresholdMin: event.target.value,
                            }));
                        }}
                        error={hasThresholdMinEmptyError || hasThresholdValueError}
                        value={thresholdInputs.thresholdMin}
                    /> */}
                    <Typography>{thresholdInputs.thresholdMin}</Typography>
                    {(hasMinMaxError || hasThresholdError) && (
                        <Typography
                            fontSize="10px"
                            variant="caption"
                            textAlign="center"
                            color="error"
                            gutterBottom={false}
                        >
                            {hasThresholdValueError
                                ? 'Min cannot be greater than or equal to Max'
                                : hasThresholdMinEmptyError
                                  ? 'Min is empty'
                                  : hasThresholdMaxEmptyError
                                    ? 'Max is empty'
                                    : hasThresholdInputEmptyError
                                      ? 'Input is empty'
                                      : 'Input is out of range'}
                        </Typography>
                    )}
                    <TextField
                        sx={{
                            width: '60px',
                            '.MuiOutlinedInput-input': {
                                padding: '4px',
                                fontSize: '14px',
                            },
                        }}
                        type="number"
                        onChange={(event) => {
                            setThresholdInputs((prev) => ({
                                ...prev,
                                thresholdMax: event.target.value,
                            }));
                        }}
                        error={hasThresholdMaxEmptyError || hasThresholdValueError}
                        value={thresholdInputs.thresholdMax}
                    />
                </Box>
            </Box>
        </Box>
    );
};

export default ThresholdSlider;
