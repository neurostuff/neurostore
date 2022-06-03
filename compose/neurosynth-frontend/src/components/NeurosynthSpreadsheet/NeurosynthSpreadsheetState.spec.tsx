import HotTable from '@handsontable/react';
import { numericRenderer, textRenderer } from 'handsontable/renderers';
import { numericValidator } from 'handsontable/validators';
import { EPropertyType } from 'components/EditMetadata'
import { AnnotationNote } from '../../neurostore-typescript-sdk';
import NeurosynthSpreadsheetHelper from './NeurosynthSpreadsheetHelper';
import NeurosynthSpreadsheetState from './NeurosynthSpreadsheetState';

jest.mock('./NeurosynthSpreadsheetHelper');

describe('NeurosynthSpreadsheetState', () => {
    const mockGetData = jest.fn();
    const mockGetRowHeader = jest.fn();
    const mockUpdateSettings = jest.fn();

    const hotTableRefMock = {
        current: {
            hotInstance: {
                getData: mockGetData,
                getRowHeader: mockGetRowHeader,
                updateSettings: mockUpdateSettings,
            },
        },
    } as unknown as React.RefObject<HotTable>;

    let STATE = new NeurosynthSpreadsheetState(hotTableRefMock, <></>, true);

    beforeEach(() => {
        mockGetData.mockClear();
        mockGetRowHeader.mockClear();
        mockUpdateSettings.mockClear();

        STATE = new NeurosynthSpreadsheetState(hotTableRefMock, <></>, true);
    });

    afterAll(() => {
        jest.clearAllMocks();
    });

    it('should initialize', () => {
        expect(STATE).toBeTruthy();
    });

    it('should add a column object and reflect the update', () => {
        STATE.addToColumnObjectList({
            value: 'some-test-value',
            type: EPropertyType.STRING,
        });

        expect(STATE.numColumns).toEqual(1);
        expect(STATE.columnValueExists('some-test-value')).toBeTruthy();
        expect(STATE.getColumnObjectAtIndex(0)).toEqual({
            value: 'some-test-value',
            type: EPropertyType.STRING,
        });
    });

    it('should add a column object and return correct information when retriving non existent items', () => {
        STATE.addToColumnObjectList({
            value: 'some-test-value',
            type: EPropertyType.STRING,
        });

        expect(STATE.numColumns).toEqual(1);
        expect(STATE.columnValueExists('non-existent-value')).toBeFalsy();
        expect(STATE.getColumnObjectAtIndex(1)).toEqual(undefined);
    });

    it('should add a study title object and reflect the update', () => {
        STATE.addToStudyTitleRowMap(0, {
            name: 'some-test-study-name',
            year: 2020,
            authors: 'Phillips Edward, Tran Max, Thomson Lucy',
            publication: 'NeuroJournal',
        });

        STATE.rowIsStudyTitle(0);
    });

    describe('buildDescriptionForStudyRow', () => {
        beforeEach(() => {
            (NeurosynthSpreadsheetHelper.BuildStudyDisplayText as jest.Mock).mockClear();
        });
        it('should call buildDescriptionForStudyRow and build the study row description', () => {
            (NeurosynthSpreadsheetHelper.BuildStudyDisplayText as jest.Mock).mockReturnValue(
                'mock-html-study-description'
            );

            STATE.addToStudyTitleRowMap(0, {
                name: 'some-test-study-name',
                year: 2020,
                authors: 'Phillips Edward, Tran Max, Thomson Lucy',
                publication: 'NeuroJournal',
            });

            const builtDescription = STATE.buildDescriptionForStudyRow(0, true);
            expect(builtDescription).toEqual('mock-html-study-description');
        });

        it('should not build if the study row does not exist', () => {
            STATE.addToStudyTitleRowMap(0, {
                name: 'some-test-study-name',
                year: 2020,
                authors: 'Phillips Edward, Tran Max, Thomson Lucy',
                publication: 'NeuroJournal',
            });

            const builtDescription = STATE.buildDescriptionForStudyRow(1, true);
            expect(builtDescription).toEqual('');
            expect(NeurosynthSpreadsheetHelper.BuildStudyDisplayText).not.toBeCalled();
        });
    });

    it('should correctly determine if the row is a study title', () => {
        STATE.addToStudyTitleRowMap(0, {
            name: 'a',
            year: 2020,
            authors: 'test-authors',
            publication: 'NeuroJournal',
        });
        STATE.addToStudyTitleRowMap(2, {
            name: 'b',
            year: 2020,
            authors: 'test-authors-2',
            publication: 'NeuroJournal',
        });

        expect(STATE.rowIsStudyTitle(0)).toBeTruthy();
        expect(STATE.rowIsStudyTitle(1)).toBeFalsy();
        expect(STATE.rowIsStudyTitle(2)).toBeTruthy();
    });

    describe('convertToAnnotationObject', () => {
        const mockAnnotationNotes: AnnotationNote[] = [
            {
                study: 'study_id_1',
                study_name: 'study_name_1',
                annotation: 'annotation_id',
                analysis_name: 'study_name_1_analysis_1',
                analysis: 'analysis_id_1',
                study_year: 2020,
                publication: 'NeuroJournal',
                authors: 'some_authors',
                note: {
                    key1: 'some value',
                    key2: true,
                    key3: 12345,
                },
            },
            {
                study: 'study_id_1',
                study_name: 'study_name_1',
                annotation: 'annotation_id',
                analysis_name: 'study_name_1_analysis_2',
                analysis: 'analysis_id_2',
                study_year: 2021,
                publication: 'NeuroJournal',
                authors: 'some_more_authors',
                note: {
                    key1: '',
                    key2: false,
                    key3: 0,
                },
            },
            {
                study: 'study_id_2',
                study_name: 'study_name_2',
                annotation: 'annotation_id',
                analysis_name: 'study_name_2_analysis',
                analysis: 'analysis_id_3',
                study_year: 2021,
                publication: 'NeuroJournal',
                authors: 'some_more_authors',
                note: {
                    key1: 'another_value',
                    key2: false,
                    key3: 0,
                },
            },
        ];

        // emulate updates made in the spreadsheet
        const mockData = [
            ['study_name_1', null, null],
            ['value_1', false, 123],
            ['value_2', true, 456],
            ['study_name_2', null, null],
            ['value_3', true, 789],
        ];

        it('should convert the given spreadsheet into an annotation object', () => {
            // make the state represent the mock data above
            STATE.addToStudyTitleRowMap(0, {
                name: mockAnnotationNotes[0].study_name as string,
                year: mockAnnotationNotes[0].study_year as number | undefined,
                authors: mockAnnotationNotes[0].authors as string,
                publication: mockAnnotationNotes[0].publication as string,
            });
            STATE.addToStudyTitleRowMap(3, {
                name: mockAnnotationNotes[0].study_name as string,
                year: mockAnnotationNotes[0].study_year as number | undefined,
                authors: mockAnnotationNotes[0].authors as string,
                publication: mockAnnotationNotes[0].publication as string,
            });
            STATE.addToColumnObjectList({
                value: 'key1',
                type: EPropertyType.STRING,
            });
            STATE.addToColumnObjectList({
                value: 'key2',
                type: EPropertyType.BOOLEAN,
            });
            STATE.addToColumnObjectList({
                value: 'key3',
                type: EPropertyType.NUMBER,
            });

            const mockAnnotation = STATE.convertToAnnotationObject(mockAnnotationNotes, mockData);
            expect(mockAnnotation.annotationNotes).toEqual([
                {
                    study: 'study_id_1',
                    study_name: 'study_name_1',
                    annotation: 'annotation_id',
                    analysis_name: 'study_name_1_analysis_1',
                    analysis: 'analysis_id_1',
                    study_year: 2020,
                    publication: 'NeuroJournal',
                    authors: 'some_authors',
                    note: {
                        key1: 'value_1',
                        key2: false,
                        key3: 123,
                    },
                },
                {
                    study: 'study_id_1',
                    study_name: 'study_name_1',
                    annotation: 'annotation_id',
                    analysis_name: 'study_name_1_analysis_2',
                    analysis: 'analysis_id_2',
                    study_year: 2021,
                    publication: 'NeuroJournal',
                    authors: 'some_more_authors',
                    note: {
                        key1: 'value_2',
                        key2: true,
                        key3: 456,
                    },
                },
                {
                    study: 'study_id_2',
                    study_name: 'study_name_2',
                    annotation: 'annotation_id',
                    analysis_name: 'study_name_2_analysis',
                    analysis: 'analysis_id_3',
                    study_year: 2021,
                    publication: 'NeuroJournal',
                    authors: 'some_more_authors',
                    note: {
                        key1: 'value_3',
                        key2: true,
                        key3: 789,
                    },
                },
            ]);
            expect(mockAnnotation.noteKeyTypes).toEqual({
                key1: EPropertyType.STRING,
                key2: EPropertyType.BOOLEAN,
                key3: EPropertyType.NUMBER,
            });
        });

        it('should return empty note objects if a spreadsheet does not have any columns', () => {
            // represent a state where we originally received annotationNotes but have deleted them via the spreadsheet
            STATE.addToStudyTitleRowMap(0, {
                name: mockAnnotationNotes[0].study_name as string,
                year: mockAnnotationNotes[0].study_year as number | undefined,
                authors: mockAnnotationNotes[0].authors as string,
                publication: mockAnnotationNotes[0].publication as string,
            });
            STATE.addToStudyTitleRowMap(3, {
                name: mockAnnotationNotes[0].study_name as string,
                year: mockAnnotationNotes[0].study_year as number | undefined,
                authors: mockAnnotationNotes[0].authors as string,
                publication: mockAnnotationNotes[0].publication as string,
            });

            const mockAnnotation = STATE.convertToAnnotationObject(mockAnnotationNotes, []);
            expect(mockAnnotation.annotationNotes).toEqual([
                {
                    study: 'study_id_1',
                    study_name: 'study_name_1',
                    annotation: 'annotation_id',
                    analysis_name: 'study_name_1_analysis_1',
                    analysis: 'analysis_id_1',
                    study_year: 2020,
                    publication: 'NeuroJournal',
                    authors: 'some_authors',
                    note: {},
                },
                {
                    study: 'study_id_1',
                    study_name: 'study_name_1',
                    annotation: 'annotation_id',
                    analysis_name: 'study_name_1_analysis_2',
                    analysis: 'analysis_id_2',
                    study_year: 2021,
                    publication: 'NeuroJournal',
                    authors: 'some_more_authors',
                    note: {},
                },
                {
                    study: 'study_id_2',
                    study_name: 'study_name_2',
                    annotation: 'annotation_id',
                    analysis_name: 'study_name_2_analysis',
                    analysis: 'analysis_id_3',
                    study_year: 2021,
                    publication: 'NeuroJournal',
                    authors: 'some_more_authors',
                    note: {},
                },
            ]);
            expect(mockAnnotation.noteKeyTypes).toEqual({});
        });
    });

    describe('removeColumnFromSpreadsheetAtIndex', () => {
        beforeEach(() => {
            STATE.addToStudyTitleRowMap(0, {
                name: 'some name 1',
                authors: 'authors 1',
                publication: 'NeuroJournal',
                year: 2020,
            });
            STATE.addToStudyTitleRowMap(2, {
                name: 'some name 2',
                authors: 'authors 2',
                publication: 'NeuroJournal',
                year: 2021,
            });

            STATE.addToColumnObjectList({
                value: 'some_string_column',
                type: EPropertyType.STRING,
            });
            STATE.addToColumnObjectList({
                value: 'some_number_column',
                type: EPropertyType.NUMBER,
            });
            STATE.addToColumnObjectList({
                value: 'some_boolean_column',
                type: EPropertyType.BOOLEAN,
            });

            (NeurosynthSpreadsheetHelper.BuildStudyDisplayText as jest.Mock).mockImplementation(
                () => 'test-row-header'
            );

            mockGetData.mockImplementation(() => {
                return [
                    ['some name 1', null, null],
                    ['a', 1, true],
                    ['some name 2', null, null],
                    ['b', 2, false],
                    ['c', 3, true],
                ];
            });

            mockGetRowHeader.mockImplementation(() => {
                return ['', 'analysis_1', '', 'analysis_2', 'analysis_3'];
            });
        });

        it('should not do anything for 0 columns', () => {
            STATE = new NeurosynthSpreadsheetState(hotTableRefMock, <></>, true);

            STATE.removeColumnFromSpreadsheetAtIndex(3);
            expect(mockGetData).not.toHaveBeenCalled();
        });

        it('should not do anything if the index is out of range', () => {
            STATE.removeColumnFromSpreadsheetAtIndex(10);
            expect(mockGetData).not.toHaveBeenCalled();
        });

        it('should remove first column correctly when there are multiple columns in the spreadsheet', () => {
            STATE.removeColumnFromSpreadsheetAtIndex(0);

            const args = mockUpdateSettings.mock.calls[0][0];
            const data = args.data;
            expect(data).toEqual([
                ['some name 1', null],
                [1, true],
                ['some name 2', null],
                [2, false],
                [3, true],
            ]);
        });

        it('should remove first column correctly when there is a single column in the spreadsheet', () => {
            mockGetData.mockClear();
            mockGetData.mockImplementation(() => {
                return [['test-row-header'], ['a'], ['test-row-header'], ['b'], ['c']];
            });

            STATE = new NeurosynthSpreadsheetState(hotTableRefMock, <></>, true);

            STATE.addToStudyTitleRowMap(0, {
                name: 'some name 1',
                authors: 'authors 1',
                publication: 'NeuroJournal',
                year: 2020,
            });
            STATE.addToStudyTitleRowMap(2, {
                name: 'some name 2',
                authors: 'authors 2',
                publication: 'NeuroJournal',
                year: 2021,
            });
            STATE.addToColumnObjectList({
                value: 'some_string_column',
                type: EPropertyType.STRING,
            });

            STATE.removeColumnFromSpreadsheetAtIndex(0);

            const args = mockUpdateSettings.mock.calls[0][0];
            const data = args.data;
            const rowHeaders = args.rowHeaders;
            expect(data).toEqual([[], [], [], [], []]);
            expect(rowHeaders).toEqual([
                'test-row-header',
                'analysis_1',
                'test-row-header',
                'analysis_2',
                'analysis_3',
            ]);
        });

        it('should remove data correctly for columns greater than 0', () => {
            STATE.removeColumnFromSpreadsheetAtIndex(1);

            const args = mockUpdateSettings.mock.calls[0][0];
            const data = args.data;
            expect(data).toEqual([
                ['some name 1', null],
                ['a', true],
                ['some name 2', null],
                ['b', false],
                ['c', true],
            ]);
        });
    });

    describe('addColumnToSpreadsheet', () => {
        beforeEach(() => {
            STATE.addToColumnObjectList({
                value: 'some string header',
                type: EPropertyType.STRING,
            });
            STATE.addToColumnObjectList({
                value: 'some boolean header',
                type: EPropertyType.BOOLEAN,
            });
            STATE.addToColumnObjectList({
                value: 'some number header',
                type: EPropertyType.NUMBER,
            });

            (NeurosynthSpreadsheetHelper.BuildStudyDisplayText as jest.Mock).mockReturnValue(
                'mock-html-study-description'
            );

            STATE.addToStudyTitleRowMap(0, {
                name: 'some name 1',
                authors: 'authors 1',
                publication: 'NeuroJournal',
                year: 2020,
            });
            STATE.addToStudyTitleRowMap(2, {
                name: 'some name 2',
                authors: 'authors 2',
                publication: 'NeuroJournal',
                year: 2021,
            });

            mockGetRowHeader.mockImplementation(() => {
                return ['', 'analysis_1', '', 'analysis2', 'analysis_3'];
            });

            mockGetData.mockImplementation(() => {
                return [
                    ['some name 1', null, null],
                    ['a', true, 1],
                    ['some name 2', null, null],
                    ['a', true, 1],
                    ['a', true, 1],
                ];
            });
        });

        it('should not do anything if a column with the given value already exists in the spreadsheet', () => {
            STATE.addColumnToSpreadsheet({
                metadataKey: 'some string header',
                metadataValue: 'ABC',
            });
            expect(mockGetData).not.toHaveBeenCalled();
        });

        it('should add a column to the spreadsheet when there are multiple columns', () => {
            STATE.addColumnToSpreadsheet({
                metadataKey: 'some new column',
                metadataValue: true,
            });

            const args = mockUpdateSettings.mock.calls[0][0];
            expect(args.rowHeaders).toBeFalsy();
            expect(args.data).toEqual([
                ['some name 1', null, null, null],
                [true, 'a', true, 1],
                ['some name 2', null, null, null],
                [true, 'a', true, 1],
                [true, 'a', true, 1],
            ]);
        });

        it('should update the row headers if this is the first column added to the spreadsheet', () => {
            mockGetRowHeader.mockClear();
            mockGetRowHeader.mockImplementation(() => {
                return ['some name 1', 'analysis_1', 'some name 2', 'analysis2', 'analysis_3'];
            });

            mockGetData.mockClear();
            mockGetData.mockImplementation(() => {
                return [[null], [null], [null], [null], [null]];
            });

            STATE = new NeurosynthSpreadsheetState(hotTableRefMock, <></>, true);
            STATE.addToStudyTitleRowMap(0, {
                name: 'some name 1',
                authors: 'authors 1',
                publication: 'NeuroJournal',
                year: 2020,
            });
            STATE.addToStudyTitleRowMap(2, {
                name: 'some name 2',
                authors: 'authors 2',
                publication: 'NeuroJournal',
                year: 2021,
            });

            STATE.addColumnToSpreadsheet({
                metadataKey: 'some new columns',
                metadataValue: 'some new value',
            });

            const args = mockUpdateSettings.mock.calls[0][0];
            expect(args.data).toEqual([
                ['mock-html-study-description'],
                ['some new value'],
                ['mock-html-study-description'],
                ['some new value'],
                ['some new value'],
            ]);

            expect(args.rowHeaders).toEqual(['', 'analysis_1', '', 'analysis2', 'analysis_3']);
        });
    });

    describe('updateSpreadsheet', () => {
        it('should update the columns, col headers, and any additional data when authenticated', () => {
            STATE = new NeurosynthSpreadsheetState(hotTableRefMock, <span>delete</span>, true);
            STATE.addToColumnObjectList({
                type: EPropertyType.STRING,
                value: 'string_key',
            });
            STATE.addToColumnObjectList({
                type: EPropertyType.NUMBER,
                value: 'number_key',
            });
            STATE.addToColumnObjectList({
                type: EPropertyType.BOOLEAN,
                value: 'boolean_key',
            });

            STATE.updateSpreadsheet({
                data: [
                    ['a', 1, true],
                    ['b', 2, false],
                    ['c', 3, true],
                ],
            });

            const stringColHeader =
                `<div class="column-header" style="max-width: 160px">` +
                `<div class="string" style="width: 75%;">string_key</div>` +
                `<div style="width: 25%;"><span data-reactroot="">delete</span></div>` +
                `</div>`;

            const numberColHeader =
                `<div class="column-header" style="max-width: 160px">` +
                `<div class="number" style="width: 75%;">number_key</div>` +
                `<div style="width: 25%;"><span data-reactroot="">delete</span></div>` +
                `</div>`;

            const booleanColHeader =
                `<div class="column-header" style="max-width: 160px">` +
                `<div class="boolean" style="width: 75%;">boolean_key</div>` +
                `<div style="width: 25%;"><span data-reactroot="">delete</span></div>` +
                `</div>`;

            const expectedColumnHeaders = [stringColHeader, numberColHeader, booleanColHeader];

            const args = mockUpdateSettings.mock.calls[0][0];
            const data = args.data;
            const colHeaders = args.colHeaders;
            const columns = args.columns;

            expect(data).toEqual([
                ['a', 1, true],
                ['b', 2, false],
                ['c', 3, true],
            ]);
            expect(colHeaders).toEqual(expectedColumnHeaders);
            expect(columns).toEqual([
                {
                    copyable: true,
                    readOnly: false,
                    type: 'text',
                    className: 'string',
                    allowInvalid: false,
                    validator: undefined,
                    renderer: textRenderer,
                },
                {
                    copyable: true,
                    readOnly: false,
                    type: 'numeric',
                    className: 'number',
                    allowInvalid: false,
                    validator: numericValidator,
                    renderer: numericRenderer,
                },
                {
                    copyable: true,
                    readOnly: false,
                    type: 'text',
                    className: 'boolean',
                    allowInvalid: false,
                    validator: expect.any(Function),
                    renderer: textRenderer,
                },
            ]);
        });

        it('should update the columns, col headers, and any additional data when unauthenticated', () => {
            mockUpdateSettings.mockClear();
            STATE = new NeurosynthSpreadsheetState(hotTableRefMock, <span>delete</span>, false);

            STATE.addToColumnObjectList({
                type: EPropertyType.STRING,
                value: 'string_key',
            });
            STATE.addToColumnObjectList({
                type: EPropertyType.NUMBER,
                value: 'number_key',
            });
            STATE.addToColumnObjectList({
                type: EPropertyType.BOOLEAN,
                value: 'boolean_key',
            });

            STATE.updateSpreadsheet({
                data: [
                    ['a', 1, true],
                    ['b', 2, false],
                    ['c', 3, true],
                ],
            });

            const stringColHeader =
                `<div class="column-header" style="max-width: 160px">` +
                `<div class="string" style="width: 75%;">string_key</div>` +
                `<div style="width: 25%;"></div>` +
                `</div>`;

            const numberColHeader =
                `<div class="column-header" style="max-width: 160px">` +
                `<div class="number" style="width: 75%;">number_key</div>` +
                `<div style="width: 25%;"></div>` +
                `</div>`;

            const booleanColHeader =
                `<div class="column-header" style="max-width: 160px">` +
                `<div class="boolean" style="width: 75%;">boolean_key</div>` +
                `<div style="width: 25%;"></div>` +
                `</div>`;

            const expectedColumnHeaders = [stringColHeader, numberColHeader, booleanColHeader];

            const args = mockUpdateSettings.mock.calls[0][0];
            const data = args.data;
            const colHeaders = args.colHeaders;
            const columns = args.columns;

            expect(data).toEqual([
                ['a', 1, true],
                ['b', 2, false],
                ['c', 3, true],
            ]);
            expect(colHeaders).toEqual(expectedColumnHeaders);
            expect(columns).toEqual([
                {
                    copyable: true,
                    readOnly: true,
                    type: 'text',
                    className: 'string',
                    allowInvalid: false,
                    validator: undefined,
                    renderer: textRenderer,
                },
                {
                    copyable: true,
                    readOnly: true,
                    type: 'numeric',
                    className: 'number',
                    allowInvalid: false,
                    validator: numericValidator,
                    renderer: numericRenderer,
                },
                {
                    copyable: true,
                    readOnly: true,
                    type: 'text',
                    className: 'boolean',
                    allowInvalid: false,
                    validator: expect.any(Function),
                    renderer: textRenderer,
                },
            ]);
        });
    });
});
