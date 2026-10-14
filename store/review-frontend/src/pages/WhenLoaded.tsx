import { Alert, Box, CircularProgress } from '@mui/material';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';

export function WhenLoaded<T>({ query, children }: { query: UseQueryResult<T>; children: (value: T) => ReactNode }) {
    if (query.isSuccess) return children(query.data);
    if (query.isError)
        return (
            <Alert severity="error" sx={{ m: 3 }}>
                {query.error.message}
            </Alert>
        );
    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
            <CircularProgress aria-label="loading" />
        </Box>
    );
}
