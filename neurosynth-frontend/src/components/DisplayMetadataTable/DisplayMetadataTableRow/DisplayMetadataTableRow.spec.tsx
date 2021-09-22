import { render, screen } from '@testing-library/react';
import { MockThemeProvider } from '../../../testing/helpers';
import DisplayMetadataTableRow from './DisplayMetadataTableRow';

describe('DisplayMetadataTableRow Component', () => {
    it('should render', () => {
        render(
            <MockThemeProvider>
                <DisplayMetadataTableRow metadataKey={'key 1'} metadataValue={'value 1'} />
            </MockThemeProvider>,
            {
                container: document.body.appendChild(document.createElement('tbody')),
            }
        );

        const rowKey = screen.getByText('key 1');
        const rowVal = screen.getByText('value 1');

        expect(rowKey).toBeInTheDocument();
        expect(rowVal).toBeInTheDocument();
    });
});
