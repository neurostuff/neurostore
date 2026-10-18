import { Box } from '@mui/material';
import { CoordinateAside } from '../coordinates/CoordinateAside';
import { CoordinatesInspector } from '../coordinates/CoordinatesInspector';
import { useReviewStores, useSession, useView } from '../store/context';
import type { ViewState } from '../store/viewStore';
import { TextPane } from '../text/TextPane';
import { CommandPalette } from './CommandPalette';
import { StepInspector } from './GuidedSteps';
import { OutlineRail } from './OutlineRail';
import { BlockedSave } from './BlockedSave';
import { ReviewAppBar } from './ReviewAppBar';
import { SaveNotices } from './SaveNotices';
import { ShortcutHelp } from './ShortcutHelp';
import { SHORTCUTS, useShortcuts } from './shortcuts';
import { SetAsideBanner, SetAsideButton } from './SetAside';
import { SplitPanes } from './SplitPanes';
import { StepBar } from './StepBar';
import { StepGuide } from './StepGuide';
import { SubmitStep } from './SubmitStep';

const noDialogOpen = (s: ViewState) => !s.helpOpen && !s.panel && !s.paletteOpen;
const onCoordinates = (s: ViewState) => s.coordinates !== null || s.panel?.kind === 'add_analysis';

export function ReviewScreen() {
    useShortcuts(useReviewStores(), SHORTCUTS, noDialogOpen);
    const submitting = useView((s) => s.step === 'submit');
    const coordinates = useView(onCoordinates);
    const viewer = useSession((s) => s.bundle.review?.user_id);
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
            <ReviewAppBar />
            <Box sx={{ display: 'flex', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <StepBar />
                </Box>
                <SetAsideButton />
            </Box>
            <StepGuide />
            <SetAsideBanner />
            {submitting && <SubmitStep />}
            <BlockedSave />
            <SaveNotices />
            <Box sx={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
                <OutlineRail />
                <SplitPanes
                    viewer={viewer}
                    text={<TextPane aside={CoordinateAside} />}
                    inspector={coordinates ? <CoordinatesInspector /> : <StepInspector />}
                />
            </Box>
            <ShortcutHelp />
            <CommandPalette />
        </Box>
    );
}
