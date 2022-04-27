import { Button } from '@mui/material';
import { useHistory } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { SystemStyleObject } from '@mui/system';

interface IBackButton {
    path: string;
    text: string;
    sx?: SystemStyleObject;
}

const BackButton: React.FC<IBackButton> = (props) => {
    const history = useHistory();

    const handleOnClick = (_event: React.MouseEvent) => {
        history.push(props.path);
    };

    return (
        <Button
            sx={props.sx || {}}
            color="secondary"
            startIcon={<ArrowBackIcon />}
            variant="outlined"
            onClick={handleOnClick}
        >
            {props.text}
        </Button>
    );
};

export default BackButton;
