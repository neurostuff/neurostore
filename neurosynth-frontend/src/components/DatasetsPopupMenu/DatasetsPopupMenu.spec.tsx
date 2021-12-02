import { render } from '@testing-library/react';
import DatasetsPopupMenu from './DatasetsPopupMenu';

describe('DatasetsPopupMenu', () => {
    it('should render', () => {
        render(<DatasetsPopupMenu datasets={[]} />);
    });
});
