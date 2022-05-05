import { INavigationButtons, ENavigationButton } from '../NavigationButtons';

const mockNavigationButtons: React.FC<INavigationButtons> = (props) => {
    return (
        <>
            <button
                // For some reason, we get a Maximum call stack size exceeded error
                // when we use the enum directly: props.onButtonClick(ENavigationButton.PREV)
                onClick={() => props.onButtonClick('PREV' as ENavigationButton.PREV)}
                data-testid="prev-button"
            >
                prev-button
            </button>
            <button
                // For some reason, we get a Maximum call stack size exceeded error
                // when we use the enum directly: props.onButtonClick(ENavigationButton.NEXT)
                onClick={() => props.onButtonClick('NEXT' as ENavigationButton.NEXT)}
                data-testid="next-button"
            >
                next-button
            </button>
        </>
    );
};

export default mockNavigationButtons;
