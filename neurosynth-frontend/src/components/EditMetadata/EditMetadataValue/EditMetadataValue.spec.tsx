import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EPropertyType } from '..';
import { MockThemeProvider } from '../../../testing/helpers';
import EditMetadataValue from './EditMetadataValue';

describe('EditMetadataValue Component', () => {
    const onEditMock = jest.fn();
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('EditMetadataBoolean Component', () => {
        beforeEach(() => {
            render(
                <MockThemeProvider>
                    <EditMetadataValue
                        value={true}
                        type={EPropertyType.BOOLEAN}
                        onEditMetadataValue={onEditMock}
                    />
                </MockThemeProvider>
            );
        });

        it('should render the editMetadataBoolean component', () => {
            const toggle = screen.getByRole('checkbox');
            expect(toggle).toBeInTheDocument();
        });

        it('should toggle the value when it is clicked', () => {
            const toggle = screen.getByRole('checkbox');
            userEvent.click(toggle);
            expect(onEditMock).toBeCalledWith(false);
        });
    });

    describe('EditMetadataNumber Component', () => {
        beforeEach(() => {
            render(
                <MockThemeProvider>
                    <EditMetadataValue
                        value={0}
                        type={EPropertyType.NUMBER}
                        onEditMetadataValue={onEditMock}
                    />
                </MockThemeProvider>
            );
        });

        it('should render the editMetadataNumber component', () => {
            const numberInput = screen.getByRole('spinbutton');
            expect(numberInput).toBeInTheDocument();
        });

        it('should emit the entered numeric value', () => {
            const numberInput = screen.getByRole('spinbutton');
            userEvent.type(numberInput, '1');
            expect(onEditMock).toBeCalledWith(1);
        });

        it('should not emit for non numeric inputs', () => {
            const numberInput = screen.getByRole('spinbutton');
            userEvent.type(numberInput, 'a');
            expect(onEditMock).not.toBeCalled();
        });
    });

    describe('EditMetadataString Component', () => {
        beforeEach(() => {
            render(
                <MockThemeProvider>
                    <EditMetadataValue
                        value={''}
                        type={EPropertyType.STRING}
                        onEditMetadataValue={onEditMock}
                    />
                </MockThemeProvider>
            );
        });

        it('should render the editMetadataString component', () => {
            const textInput = screen.getByRole('textbox');
            expect(textInput).toBeInTheDocument();
        });

        it('should emit the written text', () => {
            const textInput = screen.getByRole('textbox');
            userEvent.type(textInput, 'a');
            expect(onEditMock).toBeCalledWith('a');
        });
    });
});
