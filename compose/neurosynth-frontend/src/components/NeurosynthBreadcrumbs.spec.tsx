import { render } from '@testing-library/react';
import NeurosynthBreadcrumbs from './NeurosynthBreadcrumbs';

describe('NeurosynthBreadcrumbs Component', () => {
    it('should render', () => {
        render(<NeurosynthBreadcrumbs breadcrumbItems={[]} />);
        expect(true).toBeFalsy(); // TODO finish these tests
    });
});
