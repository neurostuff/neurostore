import { render, screen } from '@testing-library/react';
import EditAnalysesListItem from './EditAnalysesListItem';
import userEvent from '@testing-library/user-event';
import useDisplayWarnings from 'components/DisplayStudy/DisplayAnalyses/DisplayAnalysisWarnings/useDisplayWarnings';

jest.mock('components/DisplayStudy/DisplayAnalyses/DisplayAnalysisWarnings/useDisplayWarnings.tsx');
describe('EditAnalysesListItem Component', () => {
    it('should render', () => {
        render(<EditAnalysesListItem analysis={{}} selected={false} onSelectAnalysis={() => {}} />);
    });

    it('render analysis name and description', () => {
        render(
            <EditAnalysesListItem
                analysis={{ name: 'test-name', description: 'test-description' }}
                selected={false}
                onSelectAnalysis={() => {}}
            />
        );

        expect(screen.getByText('test-name')).toBeInTheDocument();
        expect(screen.getByText('test-description')).toBeInTheDocument();
    });

    it('should be selected', () => {
        render(
            <EditAnalysesListItem
                analysis={{ name: 'test-name', description: 'test-description' }}
                selected={true}
                onSelectAnalysis={() => {}}
            />
        );

        expect(screen.getByRole('button')).toHaveClass('Mui-selected');
    });

    it('should not be selected', () => {
        render(
            <EditAnalysesListItem
                analysis={{ name: 'test-name', description: 'test-description' }}
                selected={false}
                onSelectAnalysis={() => {}}
            />
        );

        expect(screen.getByRole('button')).not.toHaveClass('Mui-selected');
    });

    it('shows no name and no description', () => {
        render(
            <EditAnalysesListItem
                analysis={{ name: '', description: '' }}
                selected={false}
                onSelectAnalysis={() => {}}
            />
        );

        expect(screen.queryByText('No name')).toBeInTheDocument();
        expect(screen.queryByText('No description')).toBeInTheDocument();
    });

    it('calls onSelectAnalysis when clicked', () => {
        const handleOnSelectAnalysisMock = jest.fn();
        render(
            <EditAnalysesListItem
                analysis={{ id: 'test-id', name: 'test-name', description: 'test-description' }}
                selected={false}
                onSelectAnalysis={handleOnSelectAnalysisMock}
            />
        );
        userEvent.click(screen.getByRole('button'));
        expect(handleOnSelectAnalysisMock).toHaveBeenCalledWith('test-id');
    });

    describe('warnings', () => {
        beforeEach(() => {
            useDisplayWarnings().hasDuplicateName = false;
            useDisplayWarnings().hasNoName = false;
            useDisplayWarnings().hasNoPoints = false;
            useDisplayWarnings().hasNonMNICoordinates = false;
        });

        it('does not show a warning by default', () => {
            render(
                <EditAnalysesListItem
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

        it('shows a warning if there is a duplicate name', () => {
            useDisplayWarnings().hasDuplicateName = true;
            render(
                <EditAnalysesListItem
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

        it('shows a warning if there is no name', () => {
            useDisplayWarnings().hasDuplicateName = true;
            render(
                <EditAnalysesListItem
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
        it('shows a warning if there are no points', () => {
            useDisplayWarnings().hasDuplicateName = true;
            render(
                <EditAnalysesListItem
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
        it('shows a warning if the coordinates are not MNI', () => {
            useDisplayWarnings().hasDuplicateName = true;
            render(
                <EditAnalysesListItem
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
