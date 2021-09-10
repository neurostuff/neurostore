import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EditMetadataBoolean from './EditMetadataBoolean';

describe('EditMetadataValue Component', () => {
    const onEditMock = jest.fn();

    describe('EditMetadataBoolean Component', () => {
        it('should render the editMetadataBoolean component', () => {
            render(<EditMetadataBoolean value={true} onEdit={onEditMock} />);

            const toggle = screen.getByRole('checkbox');
            expect(toggle).toBeInTheDocument();
        });

        it('should toggle the value when its clicked', () => {
            render(<EditMetadataBoolean value={true} onEdit={onEditMock} />);
            const toggle = screen.getByRole('checkbox');
            userEvent.click(toggle);
            expect(onEditMock).toBeCalledWith(false);
        });
    });
});
