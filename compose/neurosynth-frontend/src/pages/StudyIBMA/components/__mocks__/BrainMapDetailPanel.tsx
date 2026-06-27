import type { ImageReturn } from 'neurostore-typescript-sdk';

const MockBrainMapDetailPanel: React.FC<{ image: ImageReturn; onClose: () => void }> = ({ image, onClose }) => (
    <div data-testid="mock-brain-map-detail-panel" data-image-id={image.id ?? ''}>
        <button type="button" onClick={onClose}>
            close-detail-panel
        </button>
    </div>
);

export default MockBrainMapDetailPanel;
