import { Button } from '@mui/material';
import { SystemStyleObject } from '@mui/system';
import ProgressLoader from 'components/ProgressLoader/ProgressLoader';

interface ILoadingButton {
    text: string;
    isLoading?: boolean;
    sx?: SystemStyleObject;
    variant: 'contained' | 'outlined' | 'text';
    startIcon?: React.ReactNode;
    endIcon?: React.ReactNode;
    onClick: () => void;
    color?: 'inherit' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
    disabled?: boolean;
    loaderColor?: 'inherit' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
}

const LoadingButton: React.FC<ILoadingButton> = (props) => {
    const {
        text,
        isLoading = false,
        sx = {},
        variant = 'outlined',
        startIcon = undefined,
        endIcon = undefined,
        onClick,
        color = 'primary',
        disabled = false,
        loaderColor = 'primary',
    } = props;

    const handleClick = (_event: React.MouseEvent) => {
        if (isLoading) return;
        onClick();
    };

    return (
        <Button
            disabled={disabled}
            onClick={handleClick}
            sx={sx}
            color={color}
            startIcon={isLoading ? undefined : startIcon}
            endIcon={isLoading ? undefined : endIcon}
            variant={variant}
        >
            {isLoading ? <ProgressLoader size="1.5rem" color={loaderColor} /> : text}
        </Button>
    );
};

export default LoadingButton;
