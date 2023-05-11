import { Button, ButtonProps } from '@mui/material';
import ProgressLoader from 'components/ProgressLoader/ProgressLoader';
import { ColorOptions } from 'index';

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
        loaderColor = 'primary',
        variant = 'outlined',
        onClick = () => {},
        startIcon = undefined,
        endIcon = undefined,
        ...otherProps
    } = props;

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        if (isLoading) return;
        onClick(event);
    };

    return (
        <Button
            onClick={handleClick}
            startIcon={isLoading ? undefined : startIcon}
            endIcon={isLoading ? undefined : endIcon}
            variant={variant}
            {...otherProps}
        >
            {isLoading ? <ProgressLoader size="1.5rem" color={loaderColor} /> : text}
        </Button>
    );
};

export default LoadingButton;
