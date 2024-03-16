import { Button, ButtonProps } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

interface IBackButton {
    path: string;
    text: string;
}

const BackButton: React.FC<IBackButton & ButtonProps> = (props) => {
    const navigate = useNavigate();

    const handleOnClick = (_event: React.MouseEvent) => {
        navigate(props.path);
    };

    return (
        <Button {...props} startIcon={<ArrowBackIcon />} onClick={handleOnClick}>
            {props.text}
        </Button>
    );
};

export default BackButton;
