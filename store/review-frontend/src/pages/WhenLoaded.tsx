import { Alert, Button } from '@mui/material';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Loading } from '../Loading';

type Loaded<Queries extends unknown[]> = {
    [K in keyof Queries]: Queries[K] extends UseQueryResult<infer T> ? T : never;
};

export function WhenLoaded<Queries extends UseQueryResult<unknown>[]>({
    queries,
    children,
}: {
    queries: [...Queries];
    children: (values: Loaded<Queries>) => ReactNode;
}) {
    const pending = queries.find((query) => !query.isSuccess);
    if (!pending) return children(queries.map((query) => query.data) as Loaded<Queries>);
    if (pending.isError)
        return (
            <Alert
                severity="error"
                sx={{ m: 3 }}
                action={
                    <Button color="inherit" size="small" onClick={() => void pending.refetch()}>
                        Retry
                    </Button>
                }
            >
                {pending.error.message}
            </Alert>
        );
    return <Loading />;
}
