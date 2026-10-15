import { Box } from '@mui/material';
import { Inspector } from '../inspector/Inspector';
import { useReviewStore, useReviewStoreApi } from '../store/context';
import type { ReviewState } from '../store/reviewStore';
import { TextPane } from '../text/TextPane';
import { OutlineRail } from './OutlineRail';
import { ReviewAppBar } from './ReviewAppBar';
import { SaveNotices } from './SaveNotices';
import { ShortcutHelp } from './ShortcutHelp';
import { SHORTCUTS, useShortcuts } from './shortcuts';
import { StepBar } from './StepBar';
import { SubmitStep } from './SubmitStep';

const noDialogOpen = (s: ReviewState) => !s.helpOpen;

export function ReviewScreen() {
    useShortcuts(useReviewStoreApi(), SHORTCUTS, noDialogOpen);
    const submitting = useReviewStore((s) => s.step === 'submit');
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
            <ReviewAppBar />
            <StepBar />
            {submitting && <SubmitStep />}
            <SaveNotices />
            <Box sx={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
                <OutlineRail />
                <Box component="main" sx={{ flex: '3 1 0', minWidth: 0 }}>
                    <TextPane />
                </Box>
                <Box
                    component="aside"
                    sx={{ flex: '2 1 0', minWidth: 0, overflow: 'auto', borderLeft: 1, borderColor: 'divider' }}
                >
                    <Inspector />
                </Box>
            </Box>
            <ShortcutHelp />
        </Box>
    );
}
