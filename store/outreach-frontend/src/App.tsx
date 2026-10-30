import { AppBar, Box, Link, Toolbar } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { BrowserRouter, Navigate, Route, Link as RouterLink, Routes } from 'react-router-dom';
import type { OutreachApi } from './api';
import { ApiContext } from './context';
import { DraftPage } from './pages/DraftPage';
import { PapersPage } from './pages/PapersPage';

export function App({ api }: { api: OutreachApi }) {
    const [queryClient] = useState(
        () => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } })
    );
    return (
        <ApiContext.Provider value={api}>
            <QueryClientProvider client={queryClient}>
                <BrowserRouter basename="/outreach/">
                    <AppBar position="sticky" color="primary">
                        <Toolbar>
                            <Link component={RouterLink} to="/" color="inherit" underline="none" variant="h6">
                                neurostore outreach
                            </Link>
                        </Toolbar>
                    </AppBar>
                    <Box component="main" sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
                        <Routes>
                            <Route path="/" element={<PapersPage />} />
                            <Route path="/drafts/:draftId" element={<DraftPage />} />
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </Box>
                </BrowserRouter>
            </QueryClientProvider>
        </ApiContext.Provider>
    );
}
