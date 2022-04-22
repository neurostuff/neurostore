import { render } from '@testing-library/react';
import NavigationButtons from './NavigationButtons';

describe('NavigationButtons Component', () => {
    const mockOnButtonClick = jest.fn();

    it('should render', () => {
        render(<NavigationButtons onButtonClick={mockOnButtonClick} />);
    });
});
