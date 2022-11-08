import {
    Box,
    Dialog,
    DialogContent,
    DialogTitle,
    DialogContentText,
    IconButton,
    Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import NeurosynthAutocomplete from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';

interface IAlgorithmDialog {
    isOpen: boolean;
    onCloseDialog: () => void;
}

const AlgorithmDialog: React.FC<IAlgorithmDialog> = (props) => {
    return (
        <Dialog open={props.isOpen} onClose={() => props.onCloseDialog()}>
            <DialogTitle sx={{ display: 'flex' }}>
                <Box sx={{ display: 'flex', flexGrow: 1, alignItems: 'center' }}>
                    <Typography variant="h6">Filtration Step</Typography>
                </Box>
                <Box>
                    <IconButton onClick={() => props.onCloseDialog()}>
                        <CloseIcon sx={{ fontSize: '2rem' }} />
                    </IconButton>
                </Box>
            </DialogTitle>
            <DialogContent>
                <DialogContentText sx={{ marginBottom: '1rem' }}>
                    Choose which annotation you would like to use to filter your analyses
                </DialogContentText>

                <Typography>Select algorithm</Typography>
                <NeurosynthAutocomplete
                    options={[]}
                    label="algorithm"
                    value=""
                    onChange={() => {}}
                />
                <Typography>Select optional corrector</Typography>
                <NeurosynthAutocomplete
                    options={[]}
                    label="optional corrector"
                    value=""
                    onChange={() => {}}
                />
            </DialogContent>
        </Dialog>
    );
};

export default AlgorithmDialog;
