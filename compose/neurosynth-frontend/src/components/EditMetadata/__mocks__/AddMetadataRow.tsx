import { IAddMetadataRowModel } from 'components/EditMetadata/EditMetadata.types';

const MockAddMetadataRow = (props: IAddMetadataRowModel) => {
    return (
        <>
            <button
                data-testid="trigger-add"
                onClick={() => {
                    props.onAddMetadataRow({
                        metadataKey: 'test-key',
                        metadataValue: 'test-value',
                    });
                }}
            ></button>
            <div data-testid="mock-addmetadatarow">mock add metadata row</div>;
        </>
    );
};

export default MockAddMetadataRow;
