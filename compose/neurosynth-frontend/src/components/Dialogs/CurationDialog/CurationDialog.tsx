import BaseDialog from 'components/Dialogs/BaseDialog';

interface ICurationDialog {
    onCloseDialog: () => void;
    isOpen: boolean;
}

const CurationDialog: React.FC<ICurationDialog> = (props) => {
    return (
        <BaseDialog
            maxWidth="xl"
            fullWidth
            onCloseDialog={props.onCloseDialog}
            isOpen={props.isOpen}
            dialogTitle="Curation View"
        ></BaseDialog>
    );
};

export default CurationDialog;
