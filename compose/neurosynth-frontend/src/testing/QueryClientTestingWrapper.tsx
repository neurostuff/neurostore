import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockQueryClient = new QueryClient();
const QueryClientTestingWrapper = ({ children }: { children: ReactNode }) => {
    return <QueryClientProvider client={mockQueryClient}>{children}</QueryClientProvider>;
};

export default QueryClientTestingWrapper;
