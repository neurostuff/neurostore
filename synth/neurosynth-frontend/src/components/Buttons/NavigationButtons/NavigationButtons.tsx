import { Box, Button } from '@mui/material';

export enum ENavigationButton {
    PREV = 'PREV',
    NEXT = 'NEXT',
}

export interface INavigationButtonFn {
    (button: ENavigationButton): void;
}

export interface INavigationButtons {
    prevButtonDisabled?: boolean;
    prevButtonText?: string;
    nextButtonDisabled?: boolean;
    nextButtonText?: string;
    prevButtonStyle?: 'contained' | 'outlined' | 'text';
    nextButtonStyle?: 'contained' | 'outlined' | 'text';

    onButtonClick: INavigationButtonFn;
}

const NavigationButtons: React.FC<INavigationButtons> = (props) => {
    const {
        prevButtonDisabled = false,
        prevButtonText = 'Back',
        nextButtonDisabled = false,
        nextButtonText = 'Next',
        prevButtonStyle = 'outlined',
        nextButtonStyle = 'outlined',
        onButtonClick,
    } = props;

    return (
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button
                disabled={prevButtonDisabled}
                variant={prevButtonStyle}
                onClick={() => onButtonClick(ENavigationButton.PREV)}
                sx={{ fontSize: '1rem' }}
            >
                {prevButtonText}
            </Button>
            <Button
                disabled={nextButtonDisabled}
                variant={nextButtonStyle}
                onClick={() => onButtonClick(ENavigationButton.NEXT)}
                sx={{ fontSize: '1rem' }}
            >
                {nextButtonText}
            </Button>
        </Box>
    );
};

export default NavigationButtons;
