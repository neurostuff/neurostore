import { IConfirmationDialog } from '../ConfirmationDialog';

const mockConfirmationDialog: React.FC<IConfirmationDialog> = (props) => {
    return (
        <>
            {props.isOpen && (
                <div data-testid="mock-confirmation-dialog">
                    <h1>{props.dialogTitle}</h1>
                    <div>{props.dialogMessage}</div>
                    <button
                        data-testid="accept-close-confirmation"
                        onClick={(_event) => props.onCloseDialog(true)}
                    >
                        {props.confirmText}
                    </button>
                    <button
                        data-testid="deny-close-confirmation"
                        onClick={(_event) => props.onCloseDialog(false)}
                    ></button>
                    <button
                        data-testid="undecided-close-confirmation"
                        onClick={(_event) => props.onCloseDialog(undefined)}
                    >
                        {props.rejectText}
                    </button>
                </div>
            )}
        </>
    );
};

export default mockConfirmationDialog;
