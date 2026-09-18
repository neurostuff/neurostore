import { Button } from '@mui/material';

const MoveToExtractionDialogIntroPart2 = ({ onPrev, onNext }: { onPrev: () => void; onNext: () => void }) => (
    <div data-testid="mock-move-to-extraction-intro-part-2">
        <Button onClick={onPrev}>BACK</Button>
        <Button onClick={onNext}>START</Button>
    </div>
);

export default MoveToExtractionDialogIntroPart2;
