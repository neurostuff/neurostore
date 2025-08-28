import { Skeleton, Typography } from '@mui/material';
import { Box } from '@mui/system';
import { CellContext } from '@tanstack/react-table';
import React from 'react';
import { useIsFetching } from 'react-query';
import {
    ICurationTableColumnType,
    ICurationTableStudy,
    IGenericCustomAccessorReturn,
} from '../hooks/useCuratorTableState.types';

const CuratorTableCell: React.FC<Partial<CellContext<ICurationTableStudy, ICurationTableColumnType | null>>> = (
    props
) => {
    const isFetchingExtractions = useIsFetching({ queryKey: ['extraction'] }) > 0;
    const isAI = !!props?.column?.columnDef?.meta?.AIExtractor;
    const cellValue = props.getValue ? props.getValue() : undefined;

    if (isFetchingExtractions && isAI) {
        return <Skeleton width="100%" height="40px" />;
    }

    if (cellValue === null) {
        // if there is no extraction done for the given study, we get null. This is in contrast
        // to studies that have an extraction, but some of the extracted values are null.
        return (
            <Typography color="warning.dark" style={{ fontSize: '14px' }}>
                N/A
            </Typography>
        );
    } else if (Array.isArray(cellValue) && cellValue.length === 0) {
        return (
            <Box>
                <Typography variant="caption" sx={{ color: 'warning.dark', fontSize: '14px', fontWeight: 'bold' }}>
                    ---
                </Typography>
            </Box>
        );
    } else if (Array.isArray(cellValue) && typeof cellValue[0] === 'string') {
        return (
            <Box>
                {(cellValue as string[]).map((v, index) => {
                    return (
                        <Typography
                            key={index}
                            variant="caption"
                            sx={{
                                color: cellValue.length > 0 ? 'inherit' : 'warning.dark',
                                fontSize: '14px',
                                wordBreak: 'break-word',
                                lineHeight: 1.4,
                                display: 'block',
                                marginBottom: '4px',
                            }}
                        >
                            {v || '---'}
                        </Typography>
                    );
                })}
            </Box>
        );
    } else if (Array.isArray(cellValue) && typeof cellValue[0] === 'object') {
        // extracted data in the case of IGenericCustomAccessorReturn
        return (
            <Box>
                {(cellValue as IGenericCustomAccessorReturn[]).map(({ key, value }, index) => {
                    const valueAsArray = Array.isArray(value) ? value : [value];
                    return (
                        // its possible to have multiple of the same key, so we use index as the key
                        <Box key={index} sx={{ display: 'flex', flexDirection: 'column', marginBottom: '4px' }}>
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
                                    {v === undefined || v === null ? '---' : `${v}`}
                                </Typography>
                            ))}
                        </Box>
                    );
                })}
            </Box>
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
                {displayStringValue}
            </Typography>
        );
    }
};

export default CuratorTableCell;
