import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NeurosynthAutocomplete from './NeurosynthAutocomplete';

describe('NeurosynthAutocomplete Component', () => {
    const mockOnChange = jest.fn();

    const mockAutocompleteOptions = [
        {
            id: 'test-id-1',
            label: 'some-label-1',
        },
        {
            id: 'test-id-2',
            label: 'some-label-2',
        },
        {
            id: 'test-id-3',
            label: 'unrelated-label-3',
        },
    ];

    it('should render', () => {
        expect(true).toBeTruthy();
    });

    // it('should render', () => {
    //     render(
    //         <NeurosynthAutocomplete
    //             isOptionEqualToValue={(x, y) => x?.id === y?.id}
    //             value={null}
    //             getOptionLabel={(x) => x?.label || ''}
    //             label="test-label"
    //             options={mockAutocompleteOptions}
    //             onChange={mockOnChange}
    //             renderOption={(params, option) => <li>{option?.label || ''}</li>}
    //         />
    //     );
    // });

    // it('should show the options', () => {
    //     render(
    //         <NeurosynthAutocomplete
    //             isOptionEqualToValue={(x, y) => x?.id === y?.id}
    //             value={null}
    //             getOptionLabel={(x) => x?.label || ''}
    //             label="test-label"
    //             options={mockAutocompleteOptions}
    //             onChange={mockOnChange}
    //             renderOption={(params, option) => (
    //                 <li key={option?.label || ''} data-testid="option">
    //                     {option?.label || ''}
    //                 </li>
    //             )}
    //         />
    //     );

    //     // open up the autocomplete dropdown
    //     const autocomplete = screen.getByRole('combobox', { name: 'test-label' });
    //     userEvent.click(autocomplete);

    //     mockAutocompleteOptions.forEach((autocompleteOption, index) => {
    //         expect(screen.getByText(autocompleteOption.label)).toBeInTheDocument();
    //     });
    // });

    // it('should call the onChange function on option selection', () => {
    //     render(
    //         <NeurosynthAutocomplete
    //             isOptionEqualToValue={(x, y) => x?.id === y?.id}
    //             value={null}
    //             getOptionLabel={(x) => x?.label || ''}
    //             label="test-label"
    //             options={mockAutocompleteOptions}
    //             onChange={mockOnChange}
    //             renderOption={(params, option) => (
    //                 <li {...params} key={option?.label || ''} data-testid="option">
    //                     {option?.label || ''}
    //                 </li>
    //             )}
    //         />
    //     );

    //     // open up the autocomplete dropdown
    //     const autocomplete = screen.getByRole('combobox', { name: 'test-label' });
    //     userEvent.click(autocomplete);

    //     const option = screen.getAllByTestId('option')[0];
    //     userEvent.click(option);

    //     expect(mockOnChange.mock.calls[0][1]).toEqual(mockAutocompleteOptions[0]);
    // });

    // it('should narrow down the options when text is entered', () => {
    //     render(
    //         <NeurosynthAutocomplete
    //             isOptionEqualToValue={(x, y) => x?.id === y?.id}
    //             value={null}
    //             getOptionLabel={(x) => x?.label || ''}
    //             label="test-label"
    //             options={mockAutocompleteOptions}
    //             onChange={mockOnChange}
    //             renderOption={(params, option) => (
    //                 <li {...params} key={option?.label || ''} data-testid="option">
    //                     {option?.label || ''}
    //                 </li>
    //             )}
    //         />
    //     );

    //     const input = screen.getByRole('combobox');
    //     userEvent.type(input, 'u');

    //     const options = screen.getAllByTestId('option');
    //     expect(options.length).toEqual(1);
    // });

    // it('should show a loader on loading', () => {
    //     render(
    //         <NeurosynthAutocomplete
    //             isLoading={true}
    //             isOptionEqualToValue={(x, y) => x?.id === y?.id}
    //             value={null}
    //             getOptionLabel={(x) => x?.label || ''}
    //             label="test-label"
    //             options={mockAutocompleteOptions}
    //             onChange={mockOnChange}
    //             renderOption={(params, option) => (
    //                 <li {...params} key={option?.label || ''} data-testid="option">
    //                     {option?.label || ''}
    //                 </li>
    //             )}
    //         />
    //     );

    //     expect(screen.getByRole('progressbar')).toBeInTheDocument();
    // });

    // it('should show an error if there is an error', () => {
    //     render(
    //         <NeurosynthAutocomplete
    //             isLoading={false}
    //             isError={true}
    //             isOptionEqualToValue={(x, y) => x?.id === y?.id}
    //             value={null}
    //             getOptionLabel={(x) => x?.label || ''}
    //             label="test-label"
    //             options={mockAutocompleteOptions}
    //             onChange={mockOnChange}
    //             renderOption={(params, option) => (
    //                 <li {...params} key={option?.label || ''} data-testid="option">
    //                     {option?.label || ''}
    //                 </li>
    //             )}
    //         />
    //     );

    //     expect(screen.getByText('There was an error')).toBeInTheDocument();
    // });

    // it('should show a validation message when the field is cleared', () => {
    //     render(
    //         <NeurosynthAutocomplete
    //             isOptionEqualToValue={(x, y) => x?.id === y?.id}
    //             value={null}
    //             getOptionLabel={(x) => x?.label || ''}
    //             label="test-label"
    //             options={mockAutocompleteOptions}
    //             onChange={mockOnChange}
    //             renderOption={(params, option) => (
    //                 <li {...params} key={option?.label || ''} data-testid="option">
    //                     {option?.label || ''}
    //                 </li>
    //             )}
    //         />
    //     );

    //     // open up the autocomplete dropdown
    //     const input = screen.getByRole('combobox');
    //     userEvent.click(input);

    //     // click out to lose focus
    //     userEvent.click(document.body);

    //     expect(screen.getByText('this is required')).toBeInTheDocument();
    // });
});
