import { IConfirmationDialog } from '../ConfirmationDialog';

const mockConfirmationDialog: React.FC<IConfirmationDialog> = (props) => {
    return (
        <>
            {props.isOpen && (
                <div data-testid="mock-confirmation-dialog">
                    <button
                        data-testid="accept-close-confirmation"
                        onClick={(_event) => props.onCloseDialog(true)}
                    ></button>
                    <button
                        data-testid="deny-close-confirmation"
                        onClick={(_event) => props.onCloseDialog(false)}
                    ></button>
                    <button
                        data-testid="undecided-close-confirmation"
                        onClick={(_event) => props.onCloseDialog(undefined)}
                    ></button>
                </div>
            )}
        </>
    );
};

export default mockConfirmationDialog;
