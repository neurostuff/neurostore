import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MetaAnalysisDetails from './MetaAnalysisDetails';

jest.mock('components/Buttons/NavigationButtons/NavigationButtons');

describe('MetaAnalysisDetails Component', () => {
    const mockOnUpdate = jest.fn();
    const mockOnNext = jest.fn();

    it('should render', () => {
        render(
            <MetaAnalysisDetails
                metaAnalysisName=""
                metaAnalysisDescription=""
                onNext={mockOnNext}
                onUpdate={mockOnUpdate}
            />
        );
    });

    it('should go to the next step when next is clicked', () => {
        render(
            <MetaAnalysisDetails
                metaAnalysisName=""
                metaAnalysisDescription=""
                onNext={mockOnNext}
                onUpdate={mockOnUpdate}
            />
        );
        const nextButton = screen.getByTestId('next-button');
        userEvent.click(nextButton);

        expect(mockOnNext).toHaveBeenCalled();
    });

    it('should send an update when the name field is changed', () => {
        render(
            <MetaAnalysisDetails
                metaAnalysisName=""
                metaAnalysisDescription=""
                onNext={mockOnNext}
                onUpdate={mockOnUpdate}
            />
        );

        const nameInput = screen.getByLabelText('meta-analysis name *');
        userEvent.type(nameInput, 'A');

        expect(mockOnUpdate).toHaveBeenCalledWith({
            metaAnalysisName: 'A',
        });
    });

    it('should show an error when the name input is empty and focus is lost', () => {
        render(
            <MetaAnalysisDetails
                metaAnalysisName=""
                metaAnalysisDescription=""
                onNext={mockOnNext}
                onUpdate={mockOnUpdate}
            />
        );

        // focus on name input
        const nameInput = screen.getByLabelText('meta-analysis name *');
        userEvent.click(nameInput);

        // focus away
        userEvent.click(document.body);

        expect(screen.getByText('this is required')).toBeInTheDocument();
    });

    it('should send an update when the description field is changed', () => {
        render(
            <MetaAnalysisDetails
                metaAnalysisName=""
                metaAnalysisDescription=""
                onNext={mockOnNext}
                onUpdate={mockOnUpdate}
            />
        );

        const descriptionInput = screen.getByLabelText('meta-analysis description');
        userEvent.type(descriptionInput, 'A');

        expect(mockOnUpdate).toHaveBeenCalledWith({
            metaAnalysisDescription: 'A',
        });
    });
});
