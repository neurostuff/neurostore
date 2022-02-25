import { EPropertyType } from '..';
import HotSettingsBuilder from './HotSettingsBuilder';
import NeurosynthSpreadsheetState from './NeurosynthSpreadsheetState';

jest.mock('./NeurosynthSpreadsheetState');

describe('HotSettingsHelper', () => {
    let mockNeurosynthSpreadsheetState: NeurosynthSpreadsheetState;
    let hotSettingsHelperInstance: HotSettingsBuilder;
    let mockNumColumns = 0;

    const mockGetColumnObjectAtIndex = jest.fn();
    const mockRowIsStudyTitle = jest.fn();
    const mockGetData = jest.fn();
    const mockUpdateSettings = jest.fn();
    const mockBuildDescriptionForStudyRow = jest.fn();
    const mockRemoveColumnFromSpreadsheetAtIndex = jest.fn();
    const mockSetDataAtCell = jest.fn();

    beforeEach(() => {
        (NeurosynthSpreadsheetState as any).mockImplementation(() => {
            return {
                getColumnObjectAtIndex: mockGetColumnObjectAtIndex,
                rowIsStudyTitle: mockRowIsStudyTitle,
                buildDescriptionForStudyRow: mockBuildDescriptionForStudyRow,
                removeColumnFromSpreadsheetAtIndex: mockRemoveColumnFromSpreadsheetAtIndex,
                numColumns: mockNumColumns,
                ref: {
                    getData: mockGetData,
                    updateSettings: mockUpdateSettings,
                    setDataAtCell: mockSetDataAtCell,
                },
            };
        });

        mockNeurosynthSpreadsheetState = new NeurosynthSpreadsheetState(undefined, <></>, true);
        hotSettingsHelperInstance = new HotSettingsBuilder(mockNeurosynthSpreadsheetState);
    });
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should initialize', () => {
        expect(hotSettingsHelperInstance).toBeTruthy();
    });

    describe('base settings functions', () => {
        it('should return the base settings', () => {
            const settings = hotSettingsHelperInstance.getBaseHotSettings();
            expect(settings).toBeTruthy();
        });

        describe('afterGetColHeader', () => {
            it('should set the title properly', () => {
                mockGetColumnObjectAtIndex.mockReturnValue({
                    type: EPropertyType.BOOLEAN,
                    value: 'test-value',
                });
                mockNeurosynthSpreadsheetState = new NeurosynthSpreadsheetState(
                    undefined,
                    <></>,
                    true
                );
                hotSettingsHelperInstance = new HotSettingsBuilder(mockNeurosynthSpreadsheetState);

                const settings = hotSettingsHelperInstance.getBaseHotSettings();
                const mockElement = document.createElement('th');
                settings.afterGetColHeader(0, mockElement);

                expect(mockElement.title).toEqual(
                    'valid boolean entries include "t" or "true" for true and "f" or "false" for false.'
                );
            });

            it('should not set the title for non booleans', () => {
                mockGetColumnObjectAtIndex.mockReturnValue({
                    type: EPropertyType.STRING,
                    value: 'test-value',
                });

                mockNeurosynthSpreadsheetState = new NeurosynthSpreadsheetState(
                    undefined,
                    <></>,
                    true
                );
                hotSettingsHelperInstance = new HotSettingsBuilder(mockNeurosynthSpreadsheetState);

                const settings = hotSettingsHelperInstance.getBaseHotSettings();
                const mockElement = document.createElement('th');
                settings.afterGetColHeader(0, mockElement);

                expect(mockElement.title).toEqual('');
            });

            it('should not set the title for undefined columns', () => {
                mockGetColumnObjectAtIndex.mockReturnValue(undefined);

                mockNeurosynthSpreadsheetState = new NeurosynthSpreadsheetState(
                    undefined,
                    <></>,
                    true
                );
                hotSettingsHelperInstance = new HotSettingsBuilder(mockNeurosynthSpreadsheetState);

                const settings = hotSettingsHelperInstance.getBaseHotSettings();
                const mockElement = document.createElement('th');
                settings.afterGetColHeader(0, mockElement);

                expect(mockElement.title).toEqual('');
            });
        });

        describe('afterGetRowHeader', () => {
            it('should set the styling to gray', () => {
                mockRowIsStudyTitle.mockReturnValue(true);

                mockNeurosynthSpreadsheetState = new NeurosynthSpreadsheetState(
                    undefined,
                    <></>,
                    true
                );
                hotSettingsHelperInstance = new HotSettingsBuilder(mockNeurosynthSpreadsheetState);

                const settings = hotSettingsHelperInstance.getBaseHotSettings();
                const mockElement = document.createElement('th');
                settings.afterGetRowHeader(0, mockElement);

                expect(mockElement.style.backgroundColor).toEqual('rgb(204, 204, 204)'); // equiv to #ccc
                expect(mockElement.style.color).toEqual('black');
            });

            it('should not set the styling to gray', () => {
                mockRowIsStudyTitle.mockReturnValue(false);

                mockNeurosynthSpreadsheetState = new NeurosynthSpreadsheetState(
                    undefined,
                    <></>,
                    true
                );
                hotSettingsHelperInstance = new HotSettingsBuilder(mockNeurosynthSpreadsheetState);

                const settings = hotSettingsHelperInstance.getBaseHotSettings();
                const mockElement = document.createElement('th');
                settings.afterGetRowHeader(0, mockElement);

                expect(mockElement.style.backgroundColor).not.toEqual('rgb(204, 204, 204)'); // equiv to #ccc
                expect(mockElement.style.color).not.toEqual('black');
            });
        });

        it('should call afterRefreshDimensions and rebuild the study title rows', () => {
            mockBuildDescriptionForStudyRow.mockReturnValue('new-test-study-description');
            mockRowIsStudyTitle.mockImplementation((index: number) => index === 1);
            mockGetData.mockReturnValue([
                [1, 2, 3],
                ['old-test-study-description', null, null],
                [7, 8, 9],
            ]);

            mockNeurosynthSpreadsheetState = new NeurosynthSpreadsheetState(undefined, <></>, true);
            hotSettingsHelperInstance = new HotSettingsBuilder(mockNeurosynthSpreadsheetState);

            const settings = hotSettingsHelperInstance.getBaseHotSettings();

            settings.afterRefreshDimensions({}, {}, true);
            expect(mockBuildDescriptionForStudyRow).toBeCalledWith(1, true);

            expect(mockUpdateSettings).toHaveBeenCalledWith({
                data: [
                    [1, 2, 3],
                    ['new-test-study-description', null, null],
                    [7, 8, 9],
                ],
            });
        });

        describe('afterOnCellMouseUp', () => {
            let mockMouseEvent: any;
            let mockCoords: any;
            let mockElement: any;

            beforeEach(() => {
                mockMouseEvent = {
                    target: {
                        tagName: 'svg',
                    },
                };
                mockCoords = {
                    row: -1,
                    col: 1,
                };
                mockElement = {};
            });

            it('should remove the column at the specified index for svgs', () => {
                mockNeurosynthSpreadsheetState = new NeurosynthSpreadsheetState(
                    undefined,
                    <></>,
                    true
                );
                hotSettingsHelperInstance = new HotSettingsBuilder(mockNeurosynthSpreadsheetState);
                const settings = hotSettingsHelperInstance.getBaseHotSettings();

                settings.afterOnCellMouseUp(mockMouseEvent, mockCoords, mockElement);

                expect(mockRemoveColumnFromSpreadsheetAtIndex).toBeCalledWith(1);
            });

            it('should remove the column at the specified index for paths', () => {
                mockMouseEvent.target.tagName = 'path';

                mockNeurosynthSpreadsheetState = new NeurosynthSpreadsheetState(
                    undefined,
                    <></>,
                    true
                );
                hotSettingsHelperInstance = new HotSettingsBuilder(mockNeurosynthSpreadsheetState);
                const settings = hotSettingsHelperInstance.getBaseHotSettings();

                settings.afterOnCellMouseUp(mockMouseEvent, mockCoords, mockElement);

                expect(mockRemoveColumnFromSpreadsheetAtIndex).toBeCalledWith(1);
            });

            it('should not remove the column for random tagnames', () => {
                mockMouseEvent.target.tagName = 'random-tagname';
                mockNeurosynthSpreadsheetState = new NeurosynthSpreadsheetState(
                    undefined,
                    <></>,
                    true
                );
                hotSettingsHelperInstance = new HotSettingsBuilder(mockNeurosynthSpreadsheetState);
                const settings = hotSettingsHelperInstance.getBaseHotSettings();

                settings.afterOnCellMouseUp(mockMouseEvent, mockCoords, mockElement);

                expect(mockRemoveColumnFromSpreadsheetAtIndex).not.toBeCalled();
            });

            it('should not remove the column for rows greater than 0', () => {
                mockCoords.row = 1;
                mockNeurosynthSpreadsheetState = new NeurosynthSpreadsheetState(
                    undefined,
                    <></>,
                    true
                );
                hotSettingsHelperInstance = new HotSettingsBuilder(mockNeurosynthSpreadsheetState);
                const settings = hotSettingsHelperInstance.getBaseHotSettings();

                settings.afterOnCellMouseUp(mockMouseEvent, mockCoords, mockElement);
                expect(mockRemoveColumnFromSpreadsheetAtIndex).not.toBeCalled();
            });
        });

        describe('cells', () => {
            it('should set the cell properties for study titles', () => {
                mockRowIsStudyTitle.mockReturnValue(true);
                mockNeurosynthSpreadsheetState = new NeurosynthSpreadsheetState(
                    undefined,
                    <></>,
                    true
                );
                hotSettingsHelperInstance = new HotSettingsBuilder(mockNeurosynthSpreadsheetState);
                const settings = hotSettingsHelperInstance.getBaseHotSettings();

                const cellProperties = settings.cells(0, 0, 1);
                expect(Object.keys(cellProperties).length > 0);
                expect(cellProperties.readOnly).toBeTruthy();
                expect(cellProperties.renderer).toBeTruthy();
            });

            it('should not set the cell properties', () => {
                mockRowIsStudyTitle.mockReturnValue(false);
                mockNeurosynthSpreadsheetState = new NeurosynthSpreadsheetState(
                    undefined,
                    <></>,
                    true
                );
                hotSettingsHelperInstance = new HotSettingsBuilder(mockNeurosynthSpreadsheetState);
                const settings = hotSettingsHelperInstance.getBaseHotSettings();

                const cellProperties = settings.cells(0, 0, 1);
                expect(Object.keys(cellProperties).length === 0);
            });
        });

        describe('beforeOnCellMouseDown', () => {
            const mockStopImmediatePropagation = jest.fn();
            const mockEvent = {
                stopImmediatePropagation: mockStopImmediatePropagation,
            } as any;

            const mockCoords = {
                row: 0,
                col: 0,
            } as any;

            const mockHTMLElement = {} as any;

            beforeEach(() => {
                mockStopImmediatePropagation.mockClear();
            });

            it('should stop propagation for study row titles', () => {
                mockRowIsStudyTitle.mockReturnValue(true);
                mockNeurosynthSpreadsheetState = new NeurosynthSpreadsheetState(
                    undefined,
                    <></>,
                    true
                );
                hotSettingsHelperInstance = new HotSettingsBuilder(mockNeurosynthSpreadsheetState);
                const settings = hotSettingsHelperInstance.getBaseHotSettings();

                settings.beforeOnCellMouseDown(mockEvent, mockCoords, mockHTMLElement);

                expect(mockStopImmediatePropagation).toHaveBeenCalled();
            });

            it('should not stop propagation for regular rows', () => {
                mockRowIsStudyTitle.mockReturnValue(false);
                mockNeurosynthSpreadsheetState = new NeurosynthSpreadsheetState(
                    undefined,
                    <></>,
                    true
                );
                hotSettingsHelperInstance = new HotSettingsBuilder(mockNeurosynthSpreadsheetState);
                const settings = hotSettingsHelperInstance.getBaseHotSettings();

                settings.beforeOnCellMouseDown(mockEvent, mockCoords, mockHTMLElement);

                expect(mockStopImmediatePropagation).not.toHaveBeenCalled();
            });
        });

        describe('afterChange', () => {
            it('should correctly transform the changes and call updateSpreadsheet', () => {
                mockGetColumnObjectAtIndex.mockReturnValue({
                    type: EPropertyType.BOOLEAN,
                    value: 'some-col-value',
                });
                mockNumColumns = 4;

                mockNeurosynthSpreadsheetState = new NeurosynthSpreadsheetState(
                    undefined,
                    <></>,
                    true
                );
                hotSettingsHelperInstance = new HotSettingsBuilder(mockNeurosynthSpreadsheetState);
                const settings = hotSettingsHelperInstance.getBaseHotSettings();

                settings.afterChange(
                    [
                        [0, 0, null, 'true'],
                        [0, 0, null, 't'],
                        [0, 0, null, 'false'],
                        [0, 0, null, 'f'],
                    ],
                    'populateFromArray'
                );

                expect(mockSetDataAtCell).toBeCalledWith([
                    [0, 0, true],
                    [0, 0, true],
                    [0, 0, false],
                    [0, 0, false],
                ]);
            });

            it('should not call the setDataAtCell function if no changes or no columns exist', () => {
                mockGetColumnObjectAtIndex.mockReturnValue({
                    type: EPropertyType.BOOLEAN,
                    value: 'some-col-value',
                });
                mockNumColumns = 0;
                mockNeurosynthSpreadsheetState = new NeurosynthSpreadsheetState(
                    undefined,
                    <></>,
                    true
                );
                hotSettingsHelperInstance = new HotSettingsBuilder(mockNeurosynthSpreadsheetState);
                const settings = hotSettingsHelperInstance.getBaseHotSettings();

                settings.afterChange([], 'populateFromArray');
                settings.afterChange(null, 'populateFromArray');
                settings.afterChange([[1, 2, 3, 4]], 'populateFromArray');

                expect(mockSetDataAtCell).not.toHaveBeenCalled();
            });

            it('should not update changes for non boolean columns', () => {
                mockGetColumnObjectAtIndex.mockReturnValue({
                    type: EPropertyType.STRING,
                    value: 'some-col-value',
                });

                mockNeurosynthSpreadsheetState = new NeurosynthSpreadsheetState(
                    undefined,
                    <></>,
                    true
                );
                hotSettingsHelperInstance = new HotSettingsBuilder(mockNeurosynthSpreadsheetState);
                const settings = hotSettingsHelperInstance.getBaseHotSettings();

                settings.afterChange([[0, 0, null, 't']], 'populateFromArray');

                expect(mockSetDataAtCell).not.toHaveBeenCalled();
            });

            it('should not update changes that do not need transformation', () => {
                mockGetColumnObjectAtIndex.mockReturnValue({
                    type: EPropertyType.BOOLEAN,
                    value: 'some-col-value',
                });

                mockNeurosynthSpreadsheetState = new NeurosynthSpreadsheetState(
                    undefined,
                    <></>,
                    true
                );
                hotSettingsHelperInstance = new HotSettingsBuilder(mockNeurosynthSpreadsheetState);
                const settings = hotSettingsHelperInstance.getBaseHotSettings();

                settings.afterChange(
                    [
                        [0, 0, null, true],
                        [0, 0, null, false],
                        [0, 0, null, null],
                    ],
                    'populateFromArray'
                );

                expect(mockSetDataAtCell).not.toHaveBeenCalled();
            });

            it('should not update changes for non existent columns', () => {
                mockGetColumnObjectAtIndex.mockReturnValue(undefined);

                mockNeurosynthSpreadsheetState = new NeurosynthSpreadsheetState(
                    undefined,
                    <></>,
                    true
                );
                hotSettingsHelperInstance = new HotSettingsBuilder(mockNeurosynthSpreadsheetState);
                const settings = hotSettingsHelperInstance.getBaseHotSettings();

                settings.afterChange([[0, 0, null, 't']], 'populateFromArray');

                expect(mockSetDataAtCell).not.toHaveBeenCalled();
            });
        });
    });
});
