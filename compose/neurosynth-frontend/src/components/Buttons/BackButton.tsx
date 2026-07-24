import { Button, ButtonProps } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { ArrowBack } from '@mui/icons-material';

interface IBackButton {
    path: string;
    text: string;
}

const BackButton = (props: IBackButton & ButtonProps) => {
    const navigate = useNavigate();

    const handleOnClick = (_event: React.MouseEvent) => {
        navigate(props.path);
    };

    return (
        <Button {...props} startIcon={<ArrowBack />} onClick={handleOnClick}>
            {props.text}
        </Button>
    );
};

export default BackButton;
