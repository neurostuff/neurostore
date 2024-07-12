import { render, screen } from '@testing-library/react';
import MetaAnalysisDynamicFormTitle from './MetaAnalysisDynamicFormTitle';

describe('MetaAnalysisDynamicFormTitle Component', () => {
    it('should render', () => {
        render(<MetaAnalysisDynamicFormTitle name="test-name" description="test-description" />);

        expect(screen.getByText('test-name')).toBeInTheDocument();
        expect(screen.getByText('test-description')).toBeInTheDocument();
    });
});
