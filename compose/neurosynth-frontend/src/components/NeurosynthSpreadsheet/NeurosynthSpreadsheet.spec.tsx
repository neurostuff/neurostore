import { useAuth0 } from '@auth0/auth0-react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NeurosynthSpreadsheet } from 'components';
import { EPropertyType } from 'components/EditMetadata';
import { AnnotationNote } from '../../neurostore-typescript-sdk';
import HotSettingsBuilder from './HotSettingsBuilder';
import NeurosynthSpreadsheetHelper from './NeurosynthSpreadsheetHelper';
import NeurosynthSpreadsheetState from './NeurosynthSpreadsheetState';

jest.mock('@auth0/auth0-react');
jest.mock('./NeurosynthSpreadsheetState');
jest.mock('./HotSettingsBuilder');
jest.mock('./NeurosynthSpreadsheetHelper');

/**
 * we must mock handsontable or else we get an error regarding forwardRef
 * as we refer to the ref in NeurosynthSpreadsheet
 */
jest.mock('@handsontable/react', () => {
    return 'div';
});

/**
 * Mock out Link to avoid dealing with NavLink in our test
 */
jest.mock('@mui/material/Link', () => {
    return {
        __esModule: true,
        default: (_props: any) => {
            return <span>mock link</span>;
        },
    };
});

jest.mock('../EditMetadata/EditMetadataRow/AddMetadataRow');

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

const mockNoteKeyTypes: { [key: string]: EPropertyType } = {
    key1: EPropertyType.STRING,
    key2: EPropertyType.BOOLEAN,
    key3: EPropertyType.NUMBER,
};

describe('NeurosynthSpreadsheet', () => {
    const mockOnSaveAnnotation = jest.fn();
    const mockGetColumnObjectAtIndex = jest.fn();
    const mockAddToColumnObjectList = jest.fn();
    const mockAddToStudyTitleRowMap = jest.fn();
    const mockUpdateSpreadsheet = jest.fn();
    const mockBuildDescriptionForStudyRow = jest.fn();
    const mockConvertToAnnotationObject = jest.fn();
    const mockAddColumnToSpreadsheet = jest.fn();
    const mockGetData = jest.fn();
    const mockColumnValueExists = jest.fn();

    (HotSettingsBuilder as jest.Mock).mockImplementation(() => {
        return {
            getBaseHotSettings: () => ({}),
        };
    });

    beforeEach(() => {
        useAuth0().isAuthenticated = true;
        (NeurosynthSpreadsheetState as jest.Mock).mockImplementation(() => {
            return {
                getColumnObjectAtIndex: mockGetColumnObjectAtIndex,
                convertToAnnotationObject: mockConvertToAnnotationObject,
                addToColumnObjectList: mockAddToColumnObjectList,
                addToStudyTitleRowMap: mockAddToStudyTitleRowMap,
                updateSpreadsheet: mockUpdateSpreadsheet,
                addColumnToSpreadsheet: mockAddColumnToSpreadsheet,
                columnValueExists: mockColumnValueExists,
                buildDescriptionForStudyRow: mockBuildDescriptionForStudyRow,
                ref: {
                    getData: mockGetData,
                },
            };
        });
        (NeurosynthSpreadsheetHelper.BuildStudyDisplayText as jest.Mock).mockImplementation(
            (
                name: string,
                year: number | undefined,
                authors: string,
                publication: string,
                isHTML: boolean
            ) => {
                return name;
            }
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should render', () => {
        render(
            <NeurosynthSpreadsheet
                annotationNoteKeyTypes={mockNoteKeyTypes}
                annotationNotes={mockAnnotationNotes}
                onSaveAnnotation={mockOnSaveAnnotation}
            />
        );

        const linkText = screen.getByText('mock link');
        expect(linkText).toBeInTheDocument();
    });

    it('should handle undefined annotation note values', () => {
        render(
            <NeurosynthSpreadsheet
                annotationNoteKeyTypes={mockNoteKeyTypes}
                annotationNotes={undefined}
                onSaveAnnotation={mockOnSaveAnnotation}
            />
        );

        expect(mockUpdateSpreadsheet).not.toHaveBeenCalled();
    });

    it('should handle undefined note key type values', () => {
        render(
            <NeurosynthSpreadsheet
                annotationNoteKeyTypes={undefined}
                annotationNotes={mockAnnotationNotes}
                onSaveAnnotation={mockOnSaveAnnotation}
            />
        );

        expect(mockUpdateSpreadsheet).not.toHaveBeenCalled();
    });

    it('should not update the spreadsheet if no notes exist', async () => {
        render(
            <NeurosynthSpreadsheet
                annotationNoteKeyTypes={mockNoteKeyTypes}
                annotationNotes={[]}
                onSaveAnnotation={mockOnSaveAnnotation}
            />
        );

        const spreadsheetContainer = document.querySelector('#spreadsheet-container');
        const noDataMessage = document.querySelector('#no-data-message');

        expect(spreadsheetContainer).toHaveClass('hide');
        expect(noDataMessage).toHaveClass('show');
        expect(mockUpdateSpreadsheet).not.toHaveBeenCalled();
    });

    it('should not update the spreadsheet when ref is not defined', () => {
        (NeurosynthSpreadsheetState as jest.Mock).mockClear();
        (NeurosynthSpreadsheetState as jest.Mock).mockImplementation(() => {
            return {
                getColumnObjectAtIndex: mockGetColumnObjectAtIndex,
                convertToAnnotationObject: mockConvertToAnnotationObject,
                addToColumnObjectList: mockAddToColumnObjectList,
                addToStudyTitleRowMap: mockAddToStudyTitleRowMap,
                updateSpreadsheet: mockUpdateSpreadsheet,
                buildDescriptionForStudyRow: mockBuildDescriptionForStudyRow,
                ref: undefined,
            };
        });

        render(
            <NeurosynthSpreadsheet
                annotationNoteKeyTypes={mockNoteKeyTypes}
                annotationNotes={mockAnnotationNotes}
                onSaveAnnotation={mockOnSaveAnnotation}
            />
        );

        expect(mockUpdateSpreadsheet).not.toHaveBeenCalled();
    });

    describe('when unauthenticated', () => {
        beforeEach(() => {
            useAuth0().isAuthenticated = false;
        });
        it('should disable the save annotation button', () => {
            render(
                <NeurosynthSpreadsheet
                    annotationNoteKeyTypes={mockNoteKeyTypes}
                    annotationNotes={mockAnnotationNotes}
                    onSaveAnnotation={mockOnSaveAnnotation}
                />
            );

            const saveAnnotationButton = screen.getByRole('button', {
                name: 'Save Annotation Changes',
            });

            expect(saveAnnotationButton).toBeDisabled();
        });

        it('should hide the add metadata control when there is data', () => {
            render(
                <NeurosynthSpreadsheet
                    annotationNoteKeyTypes={mockNoteKeyTypes}
                    annotationNotes={mockAnnotationNotes}
                    onSaveAnnotation={mockOnSaveAnnotation}
                />
            );

            const addMetadataElement = document.querySelector(
                'div[data-testid="mock-addmetadatarow"]'
            );
            expect(addMetadataElement?.parentElement).toHaveClass('hide');
        });

        it('should change the no columns message', () => {
            /**
             * this should technically be hidden as there are columns, but for simplicity sake we just
             * want to test the text content
             */
            render(
                <NeurosynthSpreadsheet
                    annotationNoteKeyTypes={mockNoteKeyTypes}
                    annotationNotes={mockAnnotationNotes}
                    onSaveAnnotation={mockOnSaveAnnotation}
                />
            );

            const noColumnsMessage = document.querySelector('#no-columns-message');
            expect(noColumnsMessage?.textContent).toEqual(
                'No annotations have been added yet. Start by logging in to edit'
            );
        });
    });

    it('should populate the state correctly when multiple columns exist', async () => {
        render(
            <NeurosynthSpreadsheet
                annotationNoteKeyTypes={mockNoteKeyTypes}
                annotationNotes={mockAnnotationNotes}
                onSaveAnnotation={mockOnSaveAnnotation}
            />
        );

        expect(mockAddToColumnObjectList).toHaveBeenCalledTimes(3);

        expect(mockUpdateSpreadsheet).toHaveBeenCalledWith({
            data: [
                ['study_name_1', null, null],
                ['some value', true, 12345],
                ['', false, 0],
                ['study_name_2', null, null],
                ['another_value', false, 0],
            ],
            height: '158px',
            rowHeaders: [
                '',
                'study_name_1_analysis_1',
                'study_name_1_analysis_2',
                '',
                'study_name_2_analysis',
            ],
        });

        const noColumnsMessage = document.querySelector('#no-columns-message');
        expect(noColumnsMessage).toHaveClass('hide');
    });

    describe('on receiving data with no columns', () => {
        const mockAnnotationNotesWithNoColumns: AnnotationNote[] = [
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
        ];
        const mockNoteKeyTypesNoColumns: { [key: string]: EPropertyType } = {};
        beforeEach(() => {
            (NeurosynthSpreadsheetState as jest.Mock).mockClear();
            (NeurosynthSpreadsheetState as jest.Mock).mockImplementation(() => {
                return {
                    addToColumnObjectList: mockAddToColumnObjectList,
                    addToStudyTitleRowMap: mockAddToStudyTitleRowMap,
                    updateSpreadsheet: mockUpdateSpreadsheet,
                    numColumns: 0,
                    ref: {},
                };
            });
        });

        it('should show a message', () => {
            render(
                <NeurosynthSpreadsheet
                    annotationNoteKeyTypes={mockNoteKeyTypesNoColumns}
                    annotationNotes={mockAnnotationNotesWithNoColumns}
                    onSaveAnnotation={mockOnSaveAnnotation}
                />
            );

            const noColumnsMessage = document.querySelector('#no-columns-message');
            expect(noColumnsMessage).toHaveClass('show');
            expect(noColumnsMessage?.textContent).toEqual(
                'No annotations have been added yet. Start by adding columns using the controls above'
            );
        });

        it('should populate the state correctly', () => {
            render(
                <NeurosynthSpreadsheet
                    annotationNoteKeyTypes={mockNoteKeyTypesNoColumns}
                    annotationNotes={mockAnnotationNotesWithNoColumns}
                    onSaveAnnotation={mockOnSaveAnnotation}
                />
            );

            expect(mockAddToColumnObjectList).not.toHaveBeenCalled();

            expect(mockUpdateSpreadsheet).toHaveBeenCalledWith({
                data: [[], [], [], [], []],
                height: '158px',
                rowHeaders: [
                    'study_name_1',
                    'study_name_1_analysis_1',
                    'study_name_1_analysis_2',
                    'study_name_2',
                    'study_name_2_analysis',
                ],
            });
        });
    });

    describe('addColumnHeader', () => {
        it('should add a column', () => {
            render(
                <NeurosynthSpreadsheet
                    annotationNoteKeyTypes={mockNoteKeyTypes}
                    annotationNotes={mockAnnotationNotes}
                    onSaveAnnotation={mockOnSaveAnnotation}
                />
            );

            const addMetadataButton = screen.getByTestId('trigger-add');
            userEvent.click(addMetadataButton);

            expect(mockAddColumnToSpreadsheet).toHaveBeenCalledWith({
                metadataKey: 'test-key',
                metadataValue: 'test-value',
            });
        });

        it('should return false if the key being added already exists', () => {
            mockColumnValueExists.mockReturnValue(true);
            render(
                <NeurosynthSpreadsheet
                    annotationNoteKeyTypes={mockNoteKeyTypes}
                    annotationNotes={mockAnnotationNotes}
                    onSaveAnnotation={mockOnSaveAnnotation}
                />
            );

            const addMetadataButton = screen.getByTestId('trigger-add');
            userEvent.click(addMetadataButton);

            expect(mockAddColumnToSpreadsheet).not.toHaveBeenCalled();
        });

        it('should remove the no columns message when a column is added', () => {
            const mockAnnotationNotesWithNoColumns: AnnotationNote[] = [
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
            ];
            const mockNoteKeyTypesNoColumns: { [key: string]: EPropertyType } = {};
            (NeurosynthSpreadsheetState as jest.Mock).mockClear();
            (NeurosynthSpreadsheetState as jest.Mock).mockImplementation(() => {
                return {
                    addToColumnObjectList: mockAddToColumnObjectList,
                    addToStudyTitleRowMap: mockAddToStudyTitleRowMap,
                    columnValueExists: mockColumnValueExists,
                    addColumnToSpreadsheet: mockAddColumnToSpreadsheet,
                    updateSpreadsheet: mockUpdateSpreadsheet,
                    numColumns: 0,
                    ref: {},
                };
            });
            mockColumnValueExists.mockReturnValue(false);

            render(
                <NeurosynthSpreadsheet
                    annotationNoteKeyTypes={mockNoteKeyTypesNoColumns}
                    annotationNotes={mockAnnotationNotesWithNoColumns}
                    onSaveAnnotation={mockOnSaveAnnotation}
                />
            );

            expect(document.querySelector('#no-columns-message')).toHaveClass('show');

            const addMetadataButton = screen.getByTestId('trigger-add');
            userEvent.click(addMetadataButton);

            expect(document.querySelector('#no-columns-message')).toHaveClass('hide');
        });
    });

    describe('handleOnSaveAnnotationChangeClick', () => {
        it('should not save the annotation if no ref is defined', () => {
            (NeurosynthSpreadsheetState as jest.Mock).mockClear();
            (NeurosynthSpreadsheetState as jest.Mock).mockReturnValue({
                ref: undefined,
            });

            render(
                <NeurosynthSpreadsheet
                    annotationNoteKeyTypes={mockNoteKeyTypes}
                    annotationNotes={mockAnnotationNotes}
                    onSaveAnnotation={mockOnSaveAnnotation}
                />
            );

            expect(mockOnSaveAnnotation).not.toHaveBeenCalled();
        });

        it('should not save the annotation if no annotationNotes are defined', () => {
            render(
                <NeurosynthSpreadsheet
                    annotationNoteKeyTypes={mockNoteKeyTypes}
                    annotationNotes={undefined}
                    onSaveAnnotation={mockOnSaveAnnotation}
                />
            );

            expect(mockUpdateSpreadsheet).not.toHaveBeenCalled();
        });

        it('should call handleOnSaveAnnotationChangeClick to convert the data to annotationNotes and save the annotation', () => {
            mockGetData.mockImplementation(() => {
                return {
                    getData: () => [
                        ['some value', true, 12345],
                        ['', false, 0],
                        ['another_value', false, 0],
                    ],
                };
            });

            mockConvertToAnnotationObject.mockImplementation(() => {
                return {
                    annotationNotes: [],
                    noteKeyTypes: {},
                };
            });

            render(
                <NeurosynthSpreadsheet
                    annotationNoteKeyTypes={mockNoteKeyTypes}
                    annotationNotes={mockAnnotationNotes}
                    onSaveAnnotation={mockOnSaveAnnotation}
                />
            );

            const saveAnnotationsButton = screen.getByRole('button', {
                name: 'Save Annotation Changes',
            });

            userEvent.click(saveAnnotationsButton);

            expect(mockOnSaveAnnotation).toBeCalledWith([], {});
        });
    });
});
