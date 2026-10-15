import { Alert } from '@mui/material';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Loading } from '../Loading';

export function WhenLoaded<T>({ query, children }: { query: UseQueryResult<T>; children: (value: T) => ReactNode }) {
    if (query.isSuccess) return children(query.data);
    if (query.isError)
        return (
            <Alert severity="error" sx={{ m: 3 }}>
                {query.error.message}
            </Alert>
        );
    return <Loading />;
}
