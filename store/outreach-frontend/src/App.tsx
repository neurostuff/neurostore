import { AppBar, Box, Tab, Tabs, Toolbar, Typography } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { OutreachApi } from './api';
import { ApiContext } from './context';
import { BatchPage } from './pages/BatchPage';
import { CandidatesPage } from './pages/CandidatesPage';
import { DraftPage } from './pages/DraftPage';
import { DraftsPage } from './pages/DraftsPage';
import { IN_PROGRESS } from './types';

const TABS = [
    { path: '/candidates', label: 'Candidates' },
    { path: '/drafts', label: 'Drafts' },
    { path: '/batch', label: 'Batch' },
    { path: '/in-progress', label: 'In progress' },
];

function Nav() {
    const { pathname } = useLocation();
    const current = TABS.find((tab) => pathname === tab.path)?.path ?? (pathname.startsWith('/drafts') ? '/drafts' : false);
    return (
        <AppBar position="sticky" color="primary">
            <Toolbar sx={{ gap: 3 }}>
                <Typography variant="h6" component="div">
                    neurostore outreach
                </Typography>
                <Tabs value={current} textColor="inherit" TabIndicatorProps={{ style: { backgroundColor: 'white' } }}>
                    {TABS.map((tab) => (
                        <Tab key={tab.path} value={tab.path} label={tab.label} component={Link} to={tab.path} />
                    ))}
                </Tabs>
            </Toolbar>
        </AppBar>
    );
}

export function App({ api }: { api: OutreachApi }) {
    const [queryClient] = useState(
        () => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } })
    );
    return (
        <ApiContext.Provider value={api}>
            <QueryClientProvider client={queryClient}>
                <BrowserRouter basename="/outreach">
                    <Nav />
                    <Box component="main" sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
                        <Routes>
                            <Route path="/candidates" element={<CandidatesPage />} />
                            <Route path="/drafts" element={<DraftsPage />} />
                            <Route path="/drafts/:draftId" element={<DraftPage />} />
                            <Route path="/batch" element={<BatchPage />} />
                            <Route
                                path="/in-progress"
                                element={<DraftsPage key="in-progress" initialStatus={IN_PROGRESS} inProgress />}
                            />
                            <Route path="*" element={<Navigate to="/drafts" replace />} />
                        </Routes>
                    </Box>
                </BrowserRouter>
            </QueryClientProvider>
        </ApiContext.Provider>
    );
}
