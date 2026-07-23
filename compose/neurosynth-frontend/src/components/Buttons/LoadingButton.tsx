import { Button, ButtonProps } from '@mui/material';
import ProgressLoader from 'components/ProgressLoader';
import { ColorOptions } from 'index';

const LoadingButton = (props: 
    ButtonProps & {
        text: string | React.ReactNode;
        isLoading?: boolean;
        loaderColor?: ColorOptions;
    }
) => {
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
