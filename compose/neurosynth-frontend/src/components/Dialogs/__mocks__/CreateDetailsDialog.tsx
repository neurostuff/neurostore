import { ICreateDetailsDialog } from 'components/Dialogs/CreateDetailsDialog';

const mockCreateDetailsDialog: React.FC<ICreateDetailsDialog> = (props) => {
    return (
        <>
            {props.isOpen && (
                <div data-testid="mock-create-details-dialog">
                    <h1>{props.titleText}</h1>
                    <button
                        data-testid="mock-create-button"
                        onClick={() => props.onCreate('test name', 'test description')}
                    >
                        create
                    </button>
                    <button data-testid="mock-cancel-button" onClick={props.onCloseDialog}>
                        cancel
                    </button>
                </div>
            )}
        </>
    );
};

export default mockCreateDetailsDialog;
