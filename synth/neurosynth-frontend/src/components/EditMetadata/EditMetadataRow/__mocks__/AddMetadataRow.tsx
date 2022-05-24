import { IAddMetadataRowModel } from 'components';

const MockAddMetadataRow: React.FC<IAddMetadataRowModel> = (props) => {
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
