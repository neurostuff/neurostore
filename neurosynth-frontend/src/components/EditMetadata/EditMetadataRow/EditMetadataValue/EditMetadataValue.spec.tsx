import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockThemeProvider } from '../../../../testing/helpers';
import EditMetadataBoolean from './EditMetadataBoolean';
import EditMetadataNumber from './EditMetadataNumber';
import EditMetadataString from './EditMetadataString';

describe('EditMetadataValue Component', () => {
    const onEditMock = jest.fn();
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('EditMetadataBoolean Component', () => {
        beforeEach(() => {
            render(
                <MockThemeProvider>
                    <EditMetadataBoolean value={true} onEdit={onEditMock} />
                </MockThemeProvider>
            );
        });

        it('should render the editMetadataBoolean component', () => {
            const toggle = screen.getByRole('checkbox');
            expect(toggle).toBeInTheDocument();
        });

        it('should toggle the value when its clicked', () => {
            const toggle = screen.getByRole('checkbox');
            userEvent.click(toggle);
            expect(onEditMock).toBeCalledWith(false);
        });
    });

    describe('EditMetadataNumber Component', () => {
        beforeEach(() => {
            render(
                <MockThemeProvider>
                    <EditMetadataNumber value={0} onEdit={onEditMock} />
                </MockThemeProvider>
            );
        });

        it('should render the editMetadataNumber component', () => {
            const numberInput = screen.getByRole('spinbutton');
            expect(numberInput).toBeInTheDocument();
        });

        it('should emit the entered numeric value', () => {
            const numberInput = screen.getByRole('spinbutton');
            userEvent.type(numberInput, '12345');
            expect(onEditMock).toBeCalledWith(12345);
        });

        it('should not emit for non numeric inputs', () => {
            const numberInput = screen.getByRole('spinbutton');
            userEvent.type(numberInput, 'abc');
            expect(onEditMock).not.toBeCalled();
        });
    });

    describe('EditMetadataString Component', () => {
        beforeEach(() => {
            render(
                <MockThemeProvider>
                    <EditMetadataString value={''} onEdit={onEditMock} />
                </MockThemeProvider>
            );
        });

        it('should render the editMetadataString component', () => {
            const textInput = screen.getByRole('textbox');
            expect(textInput).toBeInTheDocument();
        });

        it('should emit the written text', () => {
            const textInput = screen.getByRole('textbox');
            userEvent.type(textInput, 'abc');
            expect(onEditMock).toBeCalledWith('abc');
        });
    });
});
