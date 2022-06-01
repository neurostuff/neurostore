import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnalysisReturn } from 'neurostore-typescript-sdk';
import { mockAnalyses } from 'testing/mockData';
import EditAnalysis from './EditAnalysis';

jest.mock('./EditAnalysisDetails/EditAnalysisDetails');
jest.mock('./EditAnalysisConditions/EditAnalysisConditions');
jest.mock('./EditAnalysisImages/EditAnalysisImages');
jest.mock('./EditAnalysisPoints/EditAnalysisPoints');

describe('EditAnalysis', () => {
    let mockAnalysis: AnalysisReturn;

    beforeEach(() => {
        mockAnalysis = mockAnalyses()[0];
        render(<EditAnalysis analysis={mockAnalysis} />);
    });

    afterAll(() => {
        jest.clearAllMocks();
    });

    it('should render', () => {
        const editAnalysisDetailsTab = screen.getByText('General');
        const editAnalysisCoordinatesTab = screen.getByText('Coordinates');
        const editAnalysisConditionsTab = screen.getByText('Conditions');
        const editAnalysisImagesTab = screen.getByText('Images');

        expect(editAnalysisDetailsTab).toBeInTheDocument();
        expect(editAnalysisCoordinatesTab).toBeInTheDocument();
        expect(editAnalysisConditionsTab).toBeInTheDocument();
        expect(editAnalysisImagesTab).toBeInTheDocument();
    });

    it('should show the coordinates by default', () => {
        expect(screen.getByText('mock edit analysis points')).toBeInTheDocument();
    });

    it('should show the conditions', () => {
        userEvent.click(screen.getByText('Conditions'));
        expect(screen.getByText('mock edit analysis conditions')).toBeInTheDocument();
    });

    it('should show the images', () => {
        userEvent.click(screen.getByText('Images'));
        expect(screen.getByText('mock edit analysis images')).toBeInTheDocument();
    });

    it('should show general', () => {
        userEvent.click(screen.getByText('General'));
        expect(screen.getByText('mock edit analysis general')).toBeInTheDocument();
    });
});
