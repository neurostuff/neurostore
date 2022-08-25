import { Button, ButtonProps } from '@mui/material';
import { useHistory } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

interface IBackButton {
    path: string;
    text: string;
}

const BackButton: React.FC<IBackButton & ButtonProps> = (props) => {
    const history = useHistory();

    const handleOnClick = (_event: React.MouseEvent) => {
        history.push(props.path);
    };

    return (
        <Button {...props} startIcon={<ArrowBackIcon />} onClick={handleOnClick}>
            {props.text}
        </Button>
    );
};

export default BackButton;
