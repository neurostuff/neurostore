import HotTable from '@handsontable/react';
import Handsontable from 'handsontable';
import { CellValue } from 'handsontable/common';
import { numericValidator } from 'handsontable/validators';
import React from 'react';
import { EPropertyType, getType, IMetadataRowModel, INeurosynthColumn } from '..';
import { AnnotationNote } from '../../gen/api';
import NeurosynthSpreadsheetHelper from './NeurosynthSpreadsheetHelper';
import styles from './NeurosynthSpreadsheet.module.css';
import { numericRenderer, textRenderer } from 'handsontable/renderers';
import { renderToString } from 'react-dom/server';

interface IStudyTitleRow {
    publication: string;
    name: string;
    authors: string;
    year: number | undefined;
}

class NeurosynthSpreadsheetState {
    private hotTableRef;
    private deleteIcon;
    private isAuthenticated;

    private columnObjects: INeurosynthColumn[] = [];
    private studyTitleRows: { [key: number]: IStudyTitleRow } = {};

    get ref(): Handsontable | null | undefined {
        return this.hotTableRef?.current?.hotInstance;
    }

    get numColumns(): number {
        return this.columnObjects.length;
    }

    public getColumnObjectAtIndex = (col: number): INeurosynthColumn | undefined => {
        return this.columnObjects[col] ? { ...this.columnObjects[col] } : undefined;
    };

    public columnValueExists = (key: string): boolean => {
        return this.columnObjects.some((col) => col.value === key);
    };

    constructor(
        hotTableRef: React.RefObject<HotTable> | undefined,
        deleteIcon: JSX.Element,
        isAuthenticated: boolean
    ) {
        this.hotTableRef = hotTableRef;
        this.deleteIcon = deleteIcon;
        this.isAuthenticated = isAuthenticated;
    }

    public addToColumnObjectList = (col: INeurosynthColumn): void => {
        this.columnObjects.push(col);
    };

    public addToStudyTitleRowMap = (index: number, studyTitleRow: IStudyTitleRow): void => {
        this.studyTitleRows[index] = studyTitleRow;
    };

    public addColumnToSpreadsheet = (column: IMetadataRowModel): void => {
        const keyExists = this.columnObjects.some((col) => col.value === column.metadataKey);
        if (keyExists || !this.ref) return;
        let rowHeadersWereChanged = false;

        const updatedData: (string | boolean | number | null)[][] = this.ref.getData();
        const updatedRowHeaders = this.ref.getRowHeader();

        for (let i = 0; i < updatedData.length; i++) {
            const row = updatedData[i];
            if (this.rowIsStudyTitle(i)) {
                if (this.numColumns === 0) {
                    // we must remove the study title description from the row header and put it in the actual spreadsheet
                    // if updatedData is empty, handsontable will automatically give it a single column of null values
                    updatedRowHeaders[i] = '';
                    const newStudyDescription = this.buildDescriptionForStudyRow(i, true);
                    row[0] = newStudyDescription;
                    rowHeadersWereChanged = true;
                } else {
                    const studyDetailString = row[0];
                    row[0] = null;
                    row.unshift(studyDetailString);
                }
            } else {
                /** if a spreadsheet has 0 columns, then ref.getData() will still return an array of arrays with nulls, i.e.
                 * i.e: [ [null], [null], [null] ... ] instead of [ [], [], [], ...]
                 * Therefore, if no columns exist, we want to just set the first element to our value
                 */

                this.numColumns === 0
                    ? (row[0] = column.metadataValue)
                    : row.unshift(column.metadataValue);
            }
        }

        this.columnObjects.unshift({
            value: column.metadataKey,
            type: getType(column.metadataValue),
        });

        this.updateSpreadsheet({
            data: updatedData,
            ...(rowHeadersWereChanged ? { rowHeaders: updatedRowHeaders } : {}),
        });
    };

    public removeColumnFromSpreadsheetAtIndex = (colIndex: number): void => {
        if (
            this.numColumns <= 0 ||
            this.getColumnObjectAtIndex(colIndex) === undefined ||
            !this.ref
        )
            return;
        let rowHeadersWereChanged = false;

        const updatedData = this.ref.getData();
        const updatedRowHeaders = this.ref.getRowHeader();
        updatedData.forEach((row, index) => {
            if (this.rowIsStudyTitle(index) && colIndex === 0) {
                if (this.numColumns === 1) {
                    // we are deleting the only column in the spreadsheet
                    updatedRowHeaders[index] = this.buildDescriptionForStudyRow(index, false);
                    row.splice(0, 1);
                    rowHeadersWereChanged = true;
                } else {
                    // there is more than one column in spreadsheet and we are deleting the first item
                    const studyDetailString = row[0] as string;
                    row.splice(0, 1);
                    row[0] = studyDetailString;
                }
            } else {
                row.splice(colIndex, 1);
            }
        });

        this.columnObjects.splice(colIndex, 1);

        this.updateSpreadsheet({
            data: updatedData,
            ...(rowHeadersWereChanged ? { rowHeaders: updatedRowHeaders } : {}),
        });
    };

    public buildDescriptionForStudyRow = (studyRowIndex: number, isHTML: boolean): string => {
        const studyRowDetails = this.studyTitleRows[studyRowIndex];
        if (!studyRowDetails) return '';

        return NeurosynthSpreadsheetHelper.BuildStudyDisplayText(
            studyRowDetails.name,
            studyRowDetails.year,
            studyRowDetails.authors,
            studyRowDetails.publication,
            isHTML
        );
    };

    public updateSpreadsheet = (additionalUpdates?: { [key: string]: any }): void => {
        if (!this.ref) return;

        this.ref.updateSettings({
            columns: this.columnObjects.map((col) => {
                return {
                    copyable: true,
                    readOnly: !this.isAuthenticated,
                    type: col.type === EPropertyType.NUMBER ? 'numeric' : 'text',
                    className: styles[col.type],
                    allowInvalid: false,
                    validator: this.getValidator(col.type),
                    renderer: col.type === EPropertyType.NUMBER ? numericRenderer : textRenderer,
                };
            }),
            colHeaders: this.columnObjects.map((col) => {
                const deleteIconStr = renderToString(this.deleteIcon);

                return (
                    `<div class="${styles['column-header']}" style="max-width: ${NeurosynthSpreadsheetHelper.COL_WIDTHS}px">` +
                    `<div class="${styles[col.type]}" style="width: 75%;">${col.value}</div>` +
                    `<div style="width: 25%;">${this.isAuthenticated ? deleteIconStr : ''}</div>` +
                    `</div>`
                );
            }),
            ...additionalUpdates,
        });
    };

    public rowIsStudyTitle = (row: number): boolean => {
        return !!this.studyTitleRows[row];
    };

    public convertToAnnotationObject = (
        annotationNotes: AnnotationNote[],
        data: (string | boolean | number | null)[][]
    ) => {
        if (this.numColumns === 0) {
            const updatedAnnotationNotes = annotationNotes.map((annotationNote) => ({
                ...annotationNote,
                note: {},
            }));

            return {
                annotationNotes: updatedAnnotationNotes,
                noteKeyTypes: {},
            };
        }

        const pureData = data.filter((row, index) => !this.rowIsStudyTitle(index));
        const updatedAnnotationNotes = annotationNotes.map((annotationNote, index) => {
            const newNote: { [key: string]: string | number | boolean | null } = {};
            const row = pureData[index];
            row.forEach((value, colIndex) => {
                const colValue = this.columnObjects[colIndex].value;
                newNote[colValue] = value;
            });

            return {
                ...annotationNote,
                note: newNote,
            };
        });

        const updatedNoteKeyTypes: { [key: string]: EPropertyType } = {};
        this.columnObjects.forEach((col) => {
            updatedNoteKeyTypes[col.value] = col.type;
        });

        return {
            annotationNotes: updatedAnnotationNotes,
            noteKeyTypes: updatedNoteKeyTypes,
        };
    };

    // helper functions

    private getValidator = (type: EPropertyType) => {
        switch (type) {
            case EPropertyType.NUMBER:
                return numericValidator;
            case EPropertyType.BOOLEAN:
                return (value: CellValue, callback: (valid: boolean) => void) => {
                    const isValid = NeurosynthSpreadsheetHelper.IsSpreadsheetBoolType(value);
                    callback(isValid);
                };
            default:
                return undefined;
        }
    };
}

export default NeurosynthSpreadsheetState;
