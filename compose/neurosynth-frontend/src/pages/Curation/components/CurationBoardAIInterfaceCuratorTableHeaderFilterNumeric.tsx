import { Slider, Stack, TextField } from '@mui/material';
import { Box } from '@mui/system';
import { AccessorFn, Row } from '@tanstack/react-table';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ICurationTableColumnType, ICurationTableStudy } from '../hooks/useCuratorTableState.types';

const CurationBoardAIInterfaceCuratorTableHeaderFilterNumeric: React.FC<{
    value: [number | undefined, number | undefined] | undefined;
    rows: Row<ICurationTableStudy>[];
    accessorFn: AccessorFn<ICurationTableStudy, ICurationTableColumnType> | undefined;
    onChange: (arg: [number | undefined, number | undefined] | undefined) => void;
}> = ({ value, onChange, rows, accessorFn }) => {
    const valMin = value?.[0];
    const valMax = value?.[1];

    const touched = useRef(false);

    const [smallesTableValue, largestTableValue] = useMemo(() => {
        if (!accessorFn) return [undefined, undefined];

        let min: number | undefined = undefined;
        let max: number | undefined = undefined;

        for (const [index, row] of rows.entries()) {
            const cellValue = accessorFn(row.original, index);

            if (!cellValue || !Array.isArray(cellValue)) continue;

            for (const entry of cellValue) {
                let num = 0;
                if (typeof entry === 'number') {
                    num = entry;
                } else if (typeof entry === 'string') {
                    num = parseFloat(entry);
                } else if (typeof entry === 'object') {
                    // handle the IGenericCustomAccessorReturn case
                    num =
                        typeof entry.value === 'string'
                            ? parseFloat(entry.value)
                            : typeof entry.value === 'number'
                              ? entry.value
                              : 0;
                }

                if (min === undefined || num < min) min = num;
                if (max === undefined || num > max) max = num;
            }
        }

        return [min, max];
    }, [accessorFn, rows]);

    // we create our own state so that we can debounce the onChange
    const [rangeValue, setRangeValue] = useState<[number | undefined, number | undefined] | undefined>([
        valMin ?? smallesTableValue ?? 0,
        valMax ?? largestTableValue ?? 0,
    ]);

    useEffect(() => {
        const debounce = setTimeout(() => {
            if (touched.current) onChange(rangeValue);
        }, 300);

        return () => {
            clearTimeout(debounce);
        };
    }, [onChange, rangeValue]);

    const rangeSliderValue = [rangeValue?.[0] ?? smallesTableValue ?? 0, rangeValue?.[1] ?? largestTableValue ?? 0];

    return (
        <Box
            style={{
                padding: '0.5rem',
                maxWidth: '300px',
                display: 'flex',
                justifyContent: 'space-between',
            }}
        >
            <Stack direction="row" alignItems="center">
                <TextField
                    onChange={(e) => {
                        setRangeValue((prev) => {
                            touched.current = true;
                            if (!prev) return prev;
                            const valAsNum = parseFloat(e.target.value);
                            if (isNaN(valAsNum)) {
                                return [undefined, prev[1]];
                            }
                            return [valAsNum, prev[1]];
                        });
                    }}
                    value={rangeValue?.[0]}
                    type="number"
                    placeholder="min"
                    size="small"
                    className="no-input-arrows"
                    style={{ marginRight: '1rem' }}
                    sx={{
                        input: { fontSize: '12px' },
                    }}
                />
                <Slider
                    style={{ flexGrow: 1 }}
                    min={smallesTableValue ?? valMin ?? 0}
                    valueLabelDisplay="auto"
                    max={largestTableValue ?? valMax ?? 0}
                    size="small"
                    value={rangeSliderValue}
                    onChange={(e, value) => {
                        touched.current = true;
                        setRangeValue(value as [number, number]);
                    }}
                    disableSwap
                />
                <TextField
                    onChange={(e) => {
                        setRangeValue((prev) => {
                            touched.current = true;
                            if (!prev) return prev;
                            const valAsNum = parseFloat(e.target.value);
                            if (isNaN(valAsNum)) {
                                return [prev[0], undefined];
                            }
                            return [prev[0], valAsNum];
                        });
                    }}
                    value={rangeValue?.[1]}
                    placeholder="max"
                    size="small"
                    className="no-input-arrows"
                    style={{ marginLeft: '1rem' }}
                    sx={{
                        input: { fontSize: '12px' },
                    }}
                />
            </Stack>
            {/* <DebouncedTextField
                size="small"
                type="number"
                placeholder="Min"
                value={(min ?? '').toString()}
                sx={{
                    '.MuiInputBase-root': { paddingRight: '0px !important' },
                    width: '100px',
                    input: { fontSize: '12px' },
                }}
                onChange={(val) => {
                    handleChange(val, max);
                }}
                InputProps={{
                    endAdornment: (
                        <IconButton
                            size="small"
                            onClick={() => {
                                handleChange(undefined, max);
                            }}
                        >
                            <Close />
                        </IconButton>
                    ),
                }}
            />
            <DebouncedTextField
                size="small"
                type="number"
                placeholder="Max"
                value={(max ?? '').toString()}
                sx={{
                    '.MuiInputBase-root': { paddingRight: '0px !important' },
                    width: '100px',
                    input: { fontSize: '12px' },
                }}
                onChange={(val) => {
                    handleChange(min, val === undefined ? val : parseInt(val));
                }}
                InputProps={{
                    endAdornment: (
                        <IconButton
                            size="small"
                            onClick={() => {
                                handleChange(min, undefined);
                            }}
                        >
                            <Close />
                        </IconButton>
                    ),
                }}
            /> */}
        </Box>
    );
};

export default CurationBoardAIInterfaceCuratorTableHeaderFilterNumeric;
