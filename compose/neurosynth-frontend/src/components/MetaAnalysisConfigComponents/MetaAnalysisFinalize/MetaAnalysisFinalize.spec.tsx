import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ENavigationButton } from 'components/Buttons/NavigationButtons/NavigationButtons';
import { useCreateMetaAnalysis } from 'hooks';
import { SnackbarProvider } from 'notistack';
import { EAnalysisType } from 'pages/MetaAnalyses/MetaAnalysisBuilderPage/MetaAnalysisBuilderPage';
import { act } from 'react-dom/test-utils';
import { Router } from 'react-router-dom';
import { mockAnnotations, mockStudysets } from 'testing/mockData';
import MetaAnalysisFinalize from './MetaAnalysisFinalize';

jest.mock('hooks');

describe('MetaAnalysisFinalize', () => {
    const mockOnNavigate = jest.fn();
    it('should render', () => {
        render(
            <SnackbarProvider>
                <MetaAnalysisFinalize
                    onNavigate={mockOnNavigate}
                    analysisType={EAnalysisType.CBMA}
                    estimator={{ label: 'ALE', description: 'ALE' }}
                    estimatorArgs={{}}
                    corrector={undefined}
                    correctorArgs={{}}
                    studyset={mockStudysets()[0]}
                    annotation={mockAnnotations()[0]}
                    metaAnalysisDescription=""
                    metaAnalysisName="some-name"
                    inclusionColumn="some-col"
                />
            </SnackbarProvider>
        );
    });

    it('should call onNavigate', () => {
        render(
            <SnackbarProvider>
                <MetaAnalysisFinalize
                    onNavigate={mockOnNavigate}
                    analysisType={EAnalysisType.CBMA}
                    estimator={{ label: 'ALE', description: 'ALE' }}
                    estimatorArgs={{}}
                    corrector={undefined}
                    correctorArgs={{}}
                    studyset={mockStudysets()[0]}
                    annotation={mockAnnotations()[0]}
                    metaAnalysisDescription=""
                    metaAnalysisName="some-name"
                    inclusionColumn="some-col"
                />
            </SnackbarProvider>
        );

        userEvent.click(screen.getByRole('button', { name: 'back' }));
        expect(mockOnNavigate).toHaveBeenCalledWith(ENavigationButton.PREV);
    });

    it('should show the corrector if it exists', () => {
        render(
            <SnackbarProvider>
                <MetaAnalysisFinalize
                    onNavigate={mockOnNavigate}
                    analysisType={EAnalysisType.CBMA}
                    estimator={{ label: 'ALE', description: 'ALE' }}
                    estimatorArgs={{}}
                    corrector={{ label: 'FWECorrector', description: 'Some description' }}
                    correctorArgs={{}}
                    studyset={mockStudysets()[0]}
                    annotation={mockAnnotations()[0]}
                    metaAnalysisDescription=""
                    metaAnalysisName="some-name"
                    inclusionColumn="some-col"
                />
            </SnackbarProvider>
        );

        expect(screen.getByText('FWECorrector')).toBeInTheDocument();
    });

    it('should create the meta-analysis', () => {
        render(
            <SnackbarProvider>
                <MetaAnalysisFinalize
                    onNavigate={mockOnNavigate}
                    analysisType={EAnalysisType.CBMA}
                    estimator={{ label: 'ALE', description: 'ALE' }}
                    estimatorArgs={{}}
                    corrector={{ label: 'FWECorrector', description: 'Some description' }}
                    correctorArgs={{}}
                    studyset={mockStudysets()[0]}
                    annotation={mockAnnotations()[0]}
                    metaAnalysisDescription=""
                    metaAnalysisName="some-name"
                    inclusionColumn="some-col"
                />
            </SnackbarProvider>
        );

        userEvent.click(screen.getByRole('button', { name: 'create meta-analysis' }));
        // expect(useCreateMetaAnalysis().createMetaAnalysis).toHaveBeenCalledWith(
        //     {
        //         analysisType: EAnalysisType.CBMA,
        //         estimator: { label: 'ALE', description: 'ALE' },
        //         corrector: { label: 'FWECorrector', description: 'Some description' },
        //         studyset: mockStudysets()[0],
        //         annotation: mockAnnotations()[0],
        //         inclusionColumn: 'some-col',
        //         metaAnalysisName: 'some-name',
        //         metaAnalysisDescription: '',
        //     },
        //     {
        //         estimatorArgs: {},
        //         correctorArgs: {},
        //     }
        // );
    });

    it('should navigate to the created meta-analysis when it has been created', async () => {
        const historyMock = {
            push: jest.fn(),
            location: {},
            listen: jest.fn(),
        };

        // (useCreateMetaAnalysis().createMetaAnalysis as jest.Mock).mockImplementation(() =>
        //     Promise.resolve({ data: { id: 'test-id' } })
        // );

        render(
            <Router history={historyMock as any}>
                <SnackbarProvider>
                    <MetaAnalysisFinalize
                        onNavigate={mockOnNavigate}
                        analysisType={EAnalysisType.CBMA}
                        estimator={{ label: 'ALE', description: 'ALE' }}
                        estimatorArgs={{}}
                        corrector={{ label: 'FWECorrector', description: 'Some description' }}
                        correctorArgs={{}}
                        studyset={mockStudysets()[0]}
                        annotation={mockAnnotations()[0]}
                        metaAnalysisDescription=""
                        metaAnalysisName="some-name"
                        inclusionColumn="some-col"
                    />
                </SnackbarProvider>
            </Router>
        );
        await act(async () => {
            userEvent.click(screen.getByRole('button', { name: 'create meta-analysis' }));
        });

        expect(historyMock.push).toHaveBeenCalledWith(`/meta-analyses/test-id`);
    });
});
