import { Typography } from '@mui/material';
import { Box } from '@mui/system';
import { CellContext } from '@tanstack/react-table';
import React from 'react';
import {
    ICurationTableColumnType,
    ICurationTableStudy,
    IGenericCustomAccessorReturn,
} from '../hooks/useCuratorTableState.types';

const CuratorTableCell: React.FC<Partial<CellContext<ICurationTableStudy, ICurationTableColumnType>>> = (props) => {
    const cellValue = props.getValue ? props.getValue() : undefined;

    if (Array.isArray(cellValue) && cellValue.length === 0) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <Typography variant="caption" sx={{ color: 'warning.dark', fontSize: '14px', fontWeight: 'bold' }}>
                    ---
                </Typography>
            </Box>
        );
    } else if (Array.isArray(cellValue) && typeof cellValue[0] === 'string') {
        return (
            <>
                {(cellValue as string[]).map((v, index) => {
                    return (
                        <Typography
                            key={index}
                            variant="caption"
                            sx={{
                                color: cellValue.length > 0 ? 'inherit' : 'warning.dark',
                                fontSize: '14px',
                                wordBreak: 'break-word',
                                display: 'flex',
                                lineHeight: 1.4,
                                marginBottom: '2px',
                            }}
                        >
                            {v || '–'}
                        </Typography>
                    );
                })}
            </>
        );
    } else if (Array.isArray(cellValue) && typeof cellValue[0] === 'object') {
        return (
            <React.Fragment>
                {(cellValue as IGenericCustomAccessorReturn[]).map(({ key, value }, index) => {
                    const valueAsArray = Array.isArray(value) ? value : [value];
                    return (
                        // its possible to have multiple of the same key, so we use index as the key
                        <Box key={index} sx={{ display: 'flex', flexDirection: 'column' }}>
                            <Typography
                                variant="caption"
                                sx={{
                                    color: 'inherit',
                                    fontSize: '14px',
                                    wordBreak: 'break-word',
                                    lineHeight: 1.4,
                                }}
                            >
                                {key}
                            </Typography>
                            {valueAsArray.map((v, index) => (
                                <Typography
                                    key={index}
                                    variant="caption"
                                    sx={{
                                        color: v === undefined || v === null ? 'warning.dark' : 'gray',
                                        fontSize: '14px',
                                        wordBreak: 'break-word',
                                        lineHeight: 1.4,
                                    }}
                                >
                                    {v === undefined || v === null ? '–' : `${v}`}
                                </Typography>
                            ))}
                        </Box>
                    );
                })}
            </React.Fragment>
        );
    } else {
        const displayStringValue = `${cellValue}`;
        return (
            <Typography
                variant="caption"
                sx={{
                    color: cellValue ? 'inherit' : 'warning.dark',
                    fontSize: '14px',
                    wordBreak: 'break-word',
                    lineHeight: 1,
                }}
            >
                {displayStringValue || '–'}
            </Typography>
        );
    }
};

export default CuratorTableCell;
