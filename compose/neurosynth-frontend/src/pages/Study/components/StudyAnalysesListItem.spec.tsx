import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import StudyAnalysesListItem from './StudyAnalysesListItem';
import userEvent from '@testing-library/user-event';
import useDisplayWarnings from 'pages/Study/hooks/useDisplayWarnings';

vi.mock('pages/Study/hooks/useDisplayWarnings.tsx');
describe('StudyAnalysesListItem Component', () => {
    it('should render', async () => {
        render(<StudyAnalysesListItem analysis={{}} selected={false} onSelectAnalysis={() => {}} />);
    });

    it('render analysis name and description', async () => {
        render(
            <StudyAnalysesListItem
                analysis={{ name: 'test-name', description: 'test-description' }}
                selected={false}
                onSelectAnalysis={() => {}}
            />
        );

        expect(screen.getByText('test-name')).toBeInTheDocument();
        expect(screen.getByText('test-description')).toBeInTheDocument();
    });

    it('should be selected', async () => {
        render(
            <StudyAnalysesListItem
                analysis={{ name: 'test-name', description: 'test-description' }}
                selected={true}
                onSelectAnalysis={() => {}}
            />
        );

        expect(screen.getByRole('button')).toHaveClass('Mui-selected');
    });

    it('should not be selected', async () => {
        render(
            <StudyAnalysesListItem
                analysis={{ name: 'test-name', description: 'test-description' }}
                selected={false}
                onSelectAnalysis={() => {}}
            />
        );

        expect(screen.getByRole('button')).not.toHaveClass('Mui-selected');
    });

    it('shows no name and no description', async () => {
        render(
            <StudyAnalysesListItem
                analysis={{ name: '', description: '' }}
                selected={false}
                onSelectAnalysis={() => {}}
            />
        );

        expect(screen.queryByText('No name')).toBeInTheDocument();
        expect(screen.queryByText('No description')).toBeInTheDocument();
    });

    it('calls onSelectAnalysis when clicked', async () => {
        const handleOnSelectAnalysisMock = vi.fn();
        render(
            <StudyAnalysesListItem
                analysis={{ id: 'test-id', name: 'test-name', description: 'test-description' }}
                selected={false}
                onSelectAnalysis={handleOnSelectAnalysisMock}
            />
        );
        await userEvent.click(screen.getByRole('button'));
        expect(handleOnSelectAnalysisMock).toHaveBeenCalledWith('test-id');
    });

    describe('warnings', () => {
        beforeEach(() => {
            useDisplayWarnings().hasDuplicateName = false;
            useDisplayWarnings().hasNoName = false;
            useDisplayWarnings().hasNoPoints = false;
            useDisplayWarnings().hasNonMNICoordinates = false;
        });

        it('does not show a warning by default', async () => {
            render(
                <StudyAnalysesListItem
                    analysis={{
                        name: 'test-name',
                        description: 'test-description',
                    }}
                    selected={false}
                    onSelectAnalysis={() => {}}
                />
            );
            expect(screen.queryByTestId('ErrorOutlineIcon')).not.toBeInTheDocument();
        });

        it('shows a warning if there is a duplicate name', async () => {
            useDisplayWarnings().hasDuplicateName = true;
            render(
                <StudyAnalysesListItem
                    analysis={{
                        name: 'test-name',
                        description: 'test-description',
                    }}
                    selected={false}
                    onSelectAnalysis={() => {}}
                />
            );

            expect(screen.getByTestId('ErrorOutlineIcon')).toBeInTheDocument();
        });

        it('shows a warning if there is no name', async () => {
            useDisplayWarnings().hasDuplicateName = true;
            render(
                <StudyAnalysesListItem
                    analysis={{
                        name: 'test-name',
                        description: 'test-description',
                    }}
                    selected={false}
                    onSelectAnalysis={() => {}}
                />
            );

            expect(screen.getByTestId('ErrorOutlineIcon')).toBeInTheDocument();
        });
        it('shows a warning if there are no points', async () => {
            useDisplayWarnings().hasDuplicateName = true;
            render(
                <StudyAnalysesListItem
                    analysis={{
                        name: 'test-name',
                        description: 'test-description',
                    }}
                    selected={false}
                    onSelectAnalysis={() => {}}
                />
            );

            expect(screen.getByTestId('ErrorOutlineIcon')).toBeInTheDocument();
        });
        it('shows a warning if the coordinates are not MNI', async () => {
            useDisplayWarnings().hasDuplicateName = true;
            render(
                <StudyAnalysesListItem
                    analysis={{
                        name: 'test-name',
                        description: 'test-description',
                    }}
                    selected={false}
                    onSelectAnalysis={() => {}}
                />
            );

            expect(screen.getByTestId('ErrorOutlineIcon')).toBeInTheDocument();
        });
    });
});
