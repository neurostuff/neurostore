import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
import type { NewAnnotationColumnPayload } from 'pages/StudyIBMA/components/NewAnnotationColumnDialog';

const MockNewAnnotationColumnDialog: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    existingKeys: string[];
    onAddColumn: (payload: NewAnnotationColumnPayload) => void;
}> = ({ isOpen, onAddColumn }) =>
    isOpen ? (
        <button
            type="button"
            data-testid="mock-add-column"
            onClick={() => onAddColumn({ key: 'new_key', type: EPropertyType.BOOLEAN, default: false })}
        >
            mock-add-column
        </button>
    ) : null;

export default MockNewAnnotationColumnDialog;
