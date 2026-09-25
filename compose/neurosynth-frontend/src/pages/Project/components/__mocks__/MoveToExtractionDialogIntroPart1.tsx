import { Button } from '@mui/material';

const MoveToExtractionDialogIntroductionPart1 = ({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) => (
    <div data-testid="mock-move-to-extraction-intro-part-1">
        <Button onClick={onSkip}>Skip Extraction</Button>
        <Button onClick={onNext}>NEXT</Button>
    </div>
);

export default MoveToExtractionDialogIntroductionPart1;
