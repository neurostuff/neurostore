import { Button, ButtonProps } from '@mui/material';
import { SystemStyleObject } from '@mui/system';
import ProgressLoader from 'components/ProgressLoader/ProgressLoader';
import { ColorOptions } from 'index';

type ILoadingButton = {
    text: string;
    isLoading?: boolean;
    sx?: SystemStyleObject | SystemStyleObject[];
    variant: 'contained' | 'outlined' | 'text';
    startIcon?: React.ReactNode;
    endIcon?: React.ReactNode;
    onClick: () => void;
    color?: ColorOptions;
    disabled?: boolean;
    loaderColor?: ColorOptions;
};

const LoadingButton: React.FC<
    ButtonProps & {
        text: string;
        isLoading?: boolean;
        loaderColor?: ColorOptions;
    }
> = (props) => {
    const {
        text,
        isLoading = false,
        sx = {},
        variant = 'outlined',
        startIcon = undefined,
        endIcon = undefined,
        color,
        onClick = () => {},
        disabled = false,
        loaderColor = 'primary',
    } = props;

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        if (isLoading) return;
        onClick(event);
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
