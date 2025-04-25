import { Typography } from '@mui/material';
import { CellContext } from '@tanstack/react-table';
import { ICurationTableStudy } from '../hooks/useCuratorTableState.types';
import React from 'react';
import { Box } from '@mui/system';

const CuratorTableCell: React.FC<CellContext<ICurationTableStudy, unknown>> = (props) => {
    const value = props.getValue();

    if (Array.isArray(value)) {
        const displayStringValue = value.reduce((acc, curr, index) => {
            if (index === 0) return `${curr}`;
            return `${acc}, ${curr}`;
        }, '');
        return (
            <Typography
                variant="caption"
                sx={{
                    color: value.length > 0 ? 'inherit' : 'warning.dark',
                    fontSize: '12px',
                    wordBreak: 'break-word',
                }}
            >
                {displayStringValue || 'no data'}
            </Typography>
        );
    } else if (typeof value === 'object') {
        return (
            <React.Fragment>
                {Object.entries(value || {}).map(([key, val], index) => {
                    return (
                        <Box
                            key={key}
                            sx={{ display: 'flex', flexDirection: 'column', marginTop: index > 0 ? '1rem' : '0px' }}
                        >
                            <Typography
                                variant="caption"
                                fontWeight="bold"
                                sx={{
                                    color: 'inherit',
                                    fontSize: '10px',
                                    wordBreak: 'break-word',
                                }}
                            >
                                {key}
                            </Typography>
                            <Typography
                                variant="caption"
                                sx={{
                                    color: value ? 'inherit' : 'warning.dark',
                                    fontSize: '10px',
                                    wordBreak: 'break-word',
                                }}
                            >
                                {val || 'no data'}
                            </Typography>
                        </Box>
                    );
                })}
            </React.Fragment>
        );
    } else {
        const displayStringValue = `${value}`;
        return (
            <Typography
                variant="caption"
                sx={{
                    color: value ? 'inherit' : 'warning.dark',
                    fontSize: '12px',
                    wordBreak: 'break-word',
                }}
            >
                {displayStringValue || 'no data'}
            </Typography>
        );
    }
};

export default CuratorTableCell;
