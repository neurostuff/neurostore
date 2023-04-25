import { render, screen } from '@testing-library/react';
import DynamicFormBaseTitle from './DynamicFormBaseTitle';

describe('DynamicFormBaseTitle Component', () => {
    it('should render', () => {
        render(<DynamicFormBaseTitle name="test-name" description="test-description" />);

        expect(screen.getByText('test-name')).toBeInTheDocument();
        expect(screen.getByText('test-description')).toBeInTheDocument();
    });
});
