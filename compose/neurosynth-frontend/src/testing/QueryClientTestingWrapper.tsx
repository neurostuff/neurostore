import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockQueryClient = new QueryClient();
const QueryClientTestingWrapper: React.FC = ({ children }) => {
    return <QueryClientProvider client={mockQueryClient}>{children}</QueryClientProvider>;
};

export default QueryClientTestingWrapper;
