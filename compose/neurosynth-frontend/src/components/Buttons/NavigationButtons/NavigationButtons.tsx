import { Box, Button } from '@mui/material';
import { ColorOptions } from 'index';

export enum ENavigationButton {
    PREV = 'PREV',
    NEXT = 'NEXT',
}

export interface INavigationButtons {
    prevButtonDisabled?: boolean;
    prevButtonText?: string;
    nextButtonDisabled?: boolean;
    nextButtonText?: string;
    prevButtonStyle?: 'contained' | 'outlined' | 'text';
    nextButtonStyle?: 'contained' | 'outlined' | 'text';
    nextButtonColor?: ColorOptions;
    prevButtonColor?: ColorOptions;

    onButtonClick: (button: ENavigationButton) => void;
}

const NavigationButtons: React.FC<INavigationButtons> = (props) => {
    const {
        prevButtonDisabled = false,
        prevButtonText = 'Back',
        nextButtonDisabled = false,
        nextButtonText = 'Next',
        prevButtonStyle = 'outlined',
        nextButtonStyle = 'outlined',
        nextButtonColor = 'primary',
        prevButtonColor = 'primary',
        onButtonClick,
    } = props;

    return (
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button
                disabled={prevButtonDisabled}
                variant={prevButtonStyle}
                onClick={() => onButtonClick(ENavigationButton.PREV)}
                sx={{ fontSize: '1rem' }}
                color={prevButtonColor}
            >
                {prevButtonText}
            </Button>
            <Button
                disabled={nextButtonDisabled}
                variant={nextButtonStyle}
                onClick={() => onButtonClick(ENavigationButton.NEXT)}
                sx={{ fontSize: '1rem' }}
                color={nextButtonColor}
            >
                {nextButtonText}
            </Button>
        </Box>
    );
};

export default NavigationButtons;
