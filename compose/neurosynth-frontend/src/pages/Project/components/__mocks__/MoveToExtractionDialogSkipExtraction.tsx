import { Button } from '@mui/material';

const MoveToExtractionDialogSkipExtraction = ({
    onCancel,
    onConfirm,
}: {
    onCancel: () => void;
    onConfirm: () => void;
}) => (
    <div data-testid="mock-move-to-extraction-skip">
        <Button onClick={onCancel}>Cancel</Button>
        <Button onClick={onConfirm}>Yes, skip Extraction</Button>
    </div>
);

export default MoveToExtractionDialogSkipExtraction;
