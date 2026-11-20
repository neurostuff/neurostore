import { Box, Typography } from '@mui/material';
import { QueryClientProvider } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ApiProvider, createQueryClient } from './api/context';
import { ROLE_MESSAGE, watchForbidden, type ReviewApi } from './api/reviewApi';
import { PaperListPage } from './pages/PaperListPage';
import { ReviewPage } from './pages/ReviewPage';

function Forbidden() {
    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
            <Typography variant="h6" component="p">
                {ROLE_MESSAGE}
            </Typography>
        </Box>
    );
}

export function AppRoutes({ api }: { api: ReviewApi }) {
    const [queryClient] = useState(createQueryClient);
    const [forbidden, setForbidden] = useState(false);
    const watched = useMemo(() => watchForbidden(api, () => setForbidden(true)), [api]);
    if (forbidden) return <Forbidden />;
    return (
        <QueryClientProvider client={queryClient}>
            <ApiProvider api={watched}>
                <Routes>
                    <Route path="/" element={<PaperListPage />} />
                    <Route path="/papers/:id" element={<ReviewPage />} />
                </Routes>
            </ApiProvider>
        </QueryClientProvider>
    );
}

export function App({ api }: { api: ReviewApi }) {
    return (
        <BrowserRouter basename="/review" future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AppRoutes api={api} />
        </BrowserRouter>
    );
}
