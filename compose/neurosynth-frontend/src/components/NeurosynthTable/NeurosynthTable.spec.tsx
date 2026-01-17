import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NeurosynthTable from './NeurosynthTable';

describe('Neurosynth Table Component', () => {
    it('should render', () => {
        render(<NeurosynthTable tableConfig={{}} headerCells={[]} rows={[]} />);
    });

    describe('config', () => {
        it('should load', () => {
            render(<NeurosynthTable tableConfig={{ isLoading: true }} headerCells={[]} rows={[]} />);
            expect(screen.getByRole('progressbar')).toBeInTheDocument();
        });

        it('should display the custom no data message', () => {
            render(
                <NeurosynthTable
                    tableConfig={{ noDataDisplay: <span>test-custom-no-data-message</span> }}
                    headerCells={[]}
                    rows={[]}
                />
            );
            expect(screen.getByText('test-custom-no-data-message')).toBeInTheDocument();
        });

        it('should have the correct loader color', () => {
            render(
                <NeurosynthTable
                    tableConfig={{ isLoading: true, loaderColor: 'secondary' }}
                    headerCells={[]}
                    rows={[]}
                />
            );
            // checking for set mui classes
            expect(screen.getByRole('progressbar').className).toContain('Secondary');
        });

        it('should have the correct table elevation', () => {
            render(<NeurosynthTable tableConfig={{ tableElevation: 3 }} headerCells={[]} rows={[]} />);
            // checking for set mui classes
            expect(screen.getByRole('table')?.parentElement?.className).toContain('elevation3');
        });
    });

    describe('header cells', () => {
        it('should render the header cells', () => {
            render(
                <NeurosynthTable
                    tableConfig={{ tableElevation: 3 }}
                    headerCells={[
                        {
                            text: 'header-1',
                            key: 'header-1',
                            styles: {},
                        },
                        {
                            text: 'header-2',
                            key: 'header-2',
                            styles: {},
                        },
                    ]}
                    rows={[]}
                />
            );

            expect(screen.getByText('header-1'));
            expect(screen.getByText('header-2'));
        });

        it('should apply the relevant styling to the header row', () => {
            render(
                <NeurosynthTable
                    tableConfig={{ tableElevation: 3 }}
                    headerCells={[
                        {
                            text: 'header-1',
                            key: 'header-1',
                            styles: { fontWeight: 'bold' },
                        },
                    ]}
                    rows={[]}
                />
            );
            expect(screen.getByText('header-1')).toHaveStyle('fontWeight: 700');
        });
    });

    describe('rows', () => {
        it('should render correctly', () => {
            const mockSourceData = [
                {
                    header1: 'data-1',
                    header2: 'data-2',
                },
                {
                    header1: 'data-3',
                    header2: 'data-4',
                },
                {
                    header1: 'data-5',
                    header2: 'data-6',
                },
            ];

            render(
                <NeurosynthTable
                    tableConfig={{ tableElevation: 3 }}
                    headerCells={[
                        {
                            text: 'header-1',
                            key: 'header-1',
                            styles: { fontWeight: 'bold' },
                        },
                        {
                            text: 'header-2',
                            key: 'header-2',
                            styles: { fontWeight: 'bold' },
                        },
                    ]}
                    rows={mockSourceData.map((x, index) => (
                        <tr key={index}>
                            <td data-testid="mock-data-cell">{x.header1}</td>
                            <td data-testid="mock-data-cell">{x.header2}</td>
                        </tr>
                    ))}
                />
            );

            expect(screen.getAllByTestId('mock-data-cell').length).toEqual(mockSourceData.length * 2);

            mockSourceData.forEach((dataElement) => {
                expect(screen.getByText(dataElement.header1));
                expect(screen.getByText(dataElement.header2));
            });
        });

        it('should be able to handle a row click', () => {
            const mockHandleClick = vi.fn();

            render(
                <NeurosynthTable
                    tableConfig={{ tableElevation: 3 }}
                    headerCells={[
                        {
                            text: 'header-1',
                            key: 'header-1',
                            styles: { fontWeight: 'bold' },
                        },
                        {
                            text: 'header-2',
                            key: 'header-2',
                            styles: { fontWeight: 'bold' },
                        },
                    ]}
                    rows={[
                        <tr key="row-1" data-testid="mock-click-row" onClick={() => mockHandleClick('some-id')}>
                            <td data-testid="mock-data-cell">data-cell-1</td>
                            <td data-testid="mock-data-cell">data-cell-2</td>
                        </tr>,
                        <tr key="row-2">
                            <td data-testid="mock-data-cell">data-cell-3</td>
                            <td data-testid="mock-data-cell">data-cell-4</td>
                        </tr>,
                    ]}
                />
            );

            const clickableRow = screen.getByTestId('mock-click-row');
            userEvent.click(clickableRow);
            expect(mockHandleClick).toHaveBeenCalledWith('some-id');
        });
    });
});
