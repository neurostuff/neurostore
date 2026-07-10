import { vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EPropertyType } from './EditMetadata.types';
import { MockThemeProvider } from 'testing/helpers';
import EditMetadataValue from './EditMetadataValue';

describe('EditMetadataValue Component', () => {
    let user: ReturnType<typeof userEvent.setup>;

    const onEditMock = vi.fn();
    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('EditMetadataBoolean Component', () => {
        beforeEach(() => {
        user = userEvent.setup();
            render(
                <MockThemeProvider>
                    <EditMetadataValue value={true} type={EPropertyType.BOOLEAN} onEditMetadataValue={onEditMock} />
                </MockThemeProvider>
            );
        });

        it('should render the editMetadataBoolean component', () => {
            const toggle = screen.getByRole('checkbox');
            expect(toggle).toBeInTheDocument();
        });

        it('should toggle the value when it is clicked', async () => {
            const toggle = screen.getByRole('checkbox');
            await user.click(toggle);
            expect(onEditMock).toBeCalledWith(false);
        });
    });

    describe('EditMetadataNumber Component', () => {
        it('should render the editMetadataNumber component', () => {
            render(
                <MockThemeProvider>
                    <EditMetadataValue value={0} type={EPropertyType.NUMBER} onEditMetadataValue={onEditMock} />
                </MockThemeProvider>
            );
            const numberInput = screen.getByRole('spinbutton');
            expect(numberInput).toBeInTheDocument();
        });

        it('should emit the entered numeric value', async () => {
            render(
                <MockThemeProvider>
                    <EditMetadataValue value={0} type={EPropertyType.NUMBER} onEditMetadataValue={onEditMock} />
                </MockThemeProvider>
            );
            const numberInput = screen.getByRole('spinbutton');
            await user.type(numberInput, '1');
            expect(onEditMock).toBeCalledWith(1);
        });

        it('should not emit for non numeric inputs', async () => {
            render(
                <MockThemeProvider>
                    <EditMetadataValue value={''} type={EPropertyType.NUMBER} onEditMetadataValue={onEditMock} />
                </MockThemeProvider>
            );
            const numberInput = screen.getByRole('spinbutton');
            await user.type(numberInput, 'abcdf');
            expect(onEditMock).not.toBeCalled();
        });

        it('should accept empty inputs', async () => {
            render(
                <MockThemeProvider>
                    <EditMetadataValue value={0} type={EPropertyType.NUMBER} onEditMetadataValue={onEditMock} />
                </MockThemeProvider>
            );
            const numberInput = screen.getByRole('spinbutton');
            await user.clear(numberInput);
            expect(onEditMock).toBeCalledWith('');
        });

        it('should change to 0 on blur', async () => {
            render(
                <MockThemeProvider>
                    <EditMetadataValue value={''} type={EPropertyType.NUMBER} onEditMetadataValue={onEditMock} />
                </MockThemeProvider>
            );
            const numberInput = screen.getByRole('spinbutton');
            fireEvent.blur(numberInput);
            expect(onEditMock).toBeCalledWith(0);
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
                        placeholderText="some-placeholder"
                    />
                </MockThemeProvider>
            );
        });

        it('should render the editMetadataString component', () => {
            const textInput = screen.getByRole('textbox');
            expect(textInput).toBeInTheDocument();
        });

        it('should emit the written text', async () => {
            const textInput = screen.getByRole('textbox');
            await user.type(textInput, 'a');
            expect(onEditMock).toBeCalledWith('a');
        });

        it('should have the custom placeholder text', () => {
            const placeholder = screen.getByPlaceholderText('some-placeholder');
            expect(placeholder).toBeInTheDocument();
        });
    });
});
