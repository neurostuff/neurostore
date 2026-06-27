import type { IEditMetadataModel } from 'components/EditMetadata/EditMetadata.types';

const MockEditMetadata: React.FC<IEditMetadataModel> = (props) => (
    <div data-testid="mock-edit-metadata">
        <span data-testid="mock-metadata-count">{props.metadata.length}</span>
        <button
            type="button"
            data-testid="mock-metadata-edit"
            onClick={() => props.onMetadataRowEdit({ metadataKey: 'sample_size', metadataValue: '42' })}
        >
            simulate-metadata-edit
        </button>
    </div>
);

export default MockEditMetadata;
