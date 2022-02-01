import { useAuth0 } from '@auth0/auth0-react';
import HotTable from '@handsontable/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CellChange } from 'handsontable/common';
import React from 'react';
import { INeurosynthSpreadsheetData } from '..';
import { EPropertyType } from '../..';
import MockHandsOnTable from './N';
import NeurosynthSpreadsheet from './NeurosynthSpreadsheet';

// mock out useRef to remove warnings
// jest.mock('react', () => {
//     const originReact = jest.requireActual('react');
//     const mockedUseRef = jest.fn();

//     return {
//         ...originReact,
//         useRef: mockedUseRef,
//     };
// });

jest.mock('@handsontable/react', () => {
    return {
        __esModule: true,
        default: (props: any) => {
            const { settings } = props;

            const mockedAfterOnCellMouseDown = () => {
                settings.afterOnCellMouseDown(null, null, null);
            };

            const mockedAfterChange = (args: CellChange[]) => {
                settings.afterChange(args);
            };

            return (
                <div>
                    <button
                        data-testid="mock-after-change-f"
                        onClick={() => mockedAfterChange([[0, 'abc', true, 'f']])}
                    />
                    <button
                        data-testid="mock-after-change-t"
                        onClick={() => mockedAfterChange([[0, 'abc', true, 't']])}
                    />
                    <button
                        data-testid="mock-after-change-true"
                        onClick={() => mockedAfterChange([[0, 'abc', true, 'true']])}
                    />
                    <button
                        data-testid="mock-after-change-false"
                        onClick={() => mockedAfterChange([[0, 'abc', true, 'false']])}
                    />
                    <button
                        data-testid="mock-after-change-false"
                        onClick={() => mockedAfterChange([[0, 'abc', true, null]])}
                    />
                    <button
                        data-testid="simulate-afterOnCellMouseDown"
                        onClick={mockedAfterOnCellMouseDown}
                    />
                    <div>hot table</div>;
                </div>
            );
        },
    };
});

jest.mock('@auth0/auth0-react');

describe('NeurosynthSpreadsheet Component', () => {
    const mockOnColumnDelete = jest.fn();
    const mockOnCellUpdates = jest.fn();

    const mockSpreadsheetData: INeurosynthSpreadsheetData = {
        rowHeaderValues: [],
        columnHeaderValues: [{ value: 'abc', type: EPropertyType.BOOLEAN }],
        data: [],
        onColumnDelete: mockOnColumnDelete,
        onCellUpdates: mockOnCellUpdates,
    };

    beforeEach(() => {
        (useAuth0 as any).mockReturnValue({
            getAccessTokenSilently: () => {},
            isAuthenticated: true,
        });
    });

    it('should render', () => {
        const mockedSetDataAtCell = jest.fn();
        const mockedReturn = {
            current: {
                hotInstance: {
                    setDataAtCell: mockedSetDataAtCell,
                },
            },
        };

        jest.spyOn(React, 'useRef').mockReturnValue(mockedReturn as any);

        render(<NeurosynthSpreadsheet {...mockSpreadsheetData} />);
        const mockedTable = screen.getByText('hot table');
        expect(mockedTable).toBeInTheDocument();

        const y = screen.getByTestId('mock-after-change-f');
        userEvent.click(y);

        expect(mockedSetDataAtCell).toHaveBeenCalledWith([[0, 0, false]]);
    });

    it('should ', () => {});
});

// rowHeaderValues: string[];
// columnHeaderValues: INeurosynthCell[];
// data: {
//     [key: string]: string | number | boolean;
// }[];
// onColumnDelete: (colIndexDeleted: number, colDeleted: string) => void;
// onCellUpdates: (changes: CellChange[]) => void;
