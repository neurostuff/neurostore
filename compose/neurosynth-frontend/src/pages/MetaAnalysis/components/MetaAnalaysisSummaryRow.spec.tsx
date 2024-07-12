import { render, screen } from '@testing-library/react';
import MetaAnalysisSummaryRow from './MetaAnalysisSummaryRow';

describe('MetaAnalysisSummaryRow Component', () => {
    it('should render', () => {
        render(
            <MetaAnalysisSummaryRow title="test title" value="test value" caption="test caption" />
        );
    });

    it('should display the given values', () => {
        render(
            <MetaAnalysisSummaryRow title="test title" value="test value" caption="test caption" />
        );
        const testTitle = screen.getByText('test title');
        const testValue = screen.getByText('test value');
        const testCaption = screen.getByText('test caption');

        expect(testTitle).toBeInTheDocument();
        expect(testValue).toBeInTheDocument();
        expect(testCaption).toBeInTheDocument();
    });
});
