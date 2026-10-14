import { CssBaseline, ThemeProvider } from '@mui/material';
import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ApiProvider, createQueryClient } from './api/context';
import type { ReviewApi } from './api/reviewApi';
import { PaperListPage } from './pages/PaperListPage';
import { ReviewPage } from './pages/ReviewPage';
import { theme } from './theme';

export function AppRoutes({ api }: { api: ReviewApi }) {
    const [queryClient] = useState(createQueryClient);
    return (
        <QueryClientProvider client={queryClient}>
            <ApiProvider api={api}>
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
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <BrowserRouter basename="/review" future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <AppRoutes api={api} />
            </BrowserRouter>
        </ThemeProvider>
    );
}
