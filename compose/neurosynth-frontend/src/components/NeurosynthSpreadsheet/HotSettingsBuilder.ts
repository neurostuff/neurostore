import CellCoords from 'handsontable/3rdparty/walkontable/src/cell/coords';
import { CellChange, ChangeSource } from 'handsontable/common';
import { htmlRenderer } from 'handsontable/renderers';
import { CellMeta } from 'handsontable/settings';
import { EPropertyType } from 'components/EditMetadata';
import styles from './NeurosynthSpreadsheet.module.css';
import NeurosynthSpreadsheetHelper from './NeurosynthSpreadsheetHelper';
import NeurosynthSpreadsheetState from './NeurosynthSpreadsheetState';

class HotSettingsBuilder {
    private state;

    private data = [[]];
    private rowHeaderWidth = NeurosynthSpreadsheetHelper.ROW_HEADER_WIDTH;
    private rowHeights = NeurosynthSpreadsheetHelper.ROW_HEIGHTS;
    private height = '70px';
    private fillHandle = false;
    private contextMenu = false;
    private licenseKey = 'non-commercial-and-evaluation';
    private viewportColumnRenderingOffset = 4;
    private viewportRowRenderingOffset = 20;
    private renderAllRows = false;
    private colWidths = NeurosynthSpreadsheetHelper.COL_WIDTHS;
    private stretchH: 'all' | 'none' | 'last' | undefined = 'all';

    constructor(state: NeurosynthSpreadsheetState) {
        this.state = state;
    }

    public getBaseHotSettings() {
        return {
            data: this.data,
            rowHeaderWidth: this.rowHeaderWidth,
            rowHeights: this.rowHeights,
            height: this.height,
            fillHandle: this.fillHandle,
            contextMenu: this.contextMenu,
            licenseKey: this.licenseKey,
            viewportColumnRenderingOffset: this.viewportColumnRenderingOffset,
            viewportRowRenderingOffset: this.viewportRowRenderingOffset,
            renderAllRows: this.renderAllRows,
            colWidths: this.colWidths,
            stretchH: this.stretchH,

            afterGetColHeader: this.afterGetColHeader,
            afterGetRowHeader: this.afterGetRowHeader,
            afterRefreshDimensions: this.afterRefreshDimensions,
            afterOnCellMouseUp: this.afterOnCellMouseUp,
            cells: this.cells,
            beforeOnCellMouseDown: this.beforeOnCellMouseDown,
            afterChange: this.afterChange,
        };
    }

    /**
     * afterGetColHeader sets a hoverable message in the column header
     */
    private afterGetColHeader = (column: number, TH: HTMLElement): void => {
        const col = this.state.getColumnObjectAtIndex(column);
        if (!col) return;

        const isBoolType = col.type === EPropertyType.BOOLEAN;
        if (isBoolType) {
            TH.setAttribute(
                'title',
                'valid boolean entries include "t" or "true" for true and "f" or "false" for false.'
            );
        }
    };

    /**
     * afterGetRowHeader sets the left side row header styling
     */
    private afterGetRowHeader = (row: number, TH: HTMLElement): void => {
        if (this.state.rowIsStudyTitle(row)) {
            TH.setAttribute('style', 'background-color: #ccc; color: black;');
        }
    };

    /**
     * afterRefreshDimensions rebuilds the study description to account for new dimensions
     */
    private afterRefreshDimensions = (
        previousDimensions: object,
        currentDimensions: object,
        stateChanged: boolean
    ): void => {
        if (!this.state.ref) return;

        const data: (string | boolean | number)[][] | undefined = this.state.ref.getData();
        data?.forEach((row, index) => {
            if (this.state.rowIsStudyTitle(index)) {
                data[index][0] = this.state.buildDescriptionForStudyRow(index, true);
            }
        });
        this.state.ref.updateSettings({
            data: data,
        });
    };

    /**
     * afterOnCellMouseUp handles clicking the delete button
     */
    private afterOnCellMouseUp = (
        event: MouseEvent,
        coords: CellCoords,
        TD: HTMLTableCellElement
    ): void => {
        const target = event.target as HTMLButtonElement;
        if (coords.row < 0 && (target.tagName === 'svg' || target.tagName === 'path')) {
            this.state.removeColumnFromSpreadsheetAtIndex(coords.col);
        }
    };

    /**
     * cells sets the row as a special study row with applied styling and HTML handling
     */
    private cells = (row: number, column: number, prop: string | number): CellMeta => {
        const cellProperties: any = {};
        if (this.state.rowIsStudyTitle(row)) {
            cellProperties.readOnly = true;
            cellProperties.renderer = htmlRenderer;
            cellProperties.className = styles['study-details-row'];
        }
        return cellProperties;
    };

    /**
     * beforeOnCellMouseDown prevents the user from selecting the study title rows
     */
    private beforeOnCellMouseDown = (event: MouseEvent, coords: CellCoords, TH: HTMLElement) => {
        // Prevent study name from being selectable and copyable
        if (this.state.rowIsStudyTitle(coords.row)) event.stopImmediatePropagation();
    };

    /**
     * afterChange sets the value of boolean columns to be true if "t" is entered
     */
    private afterChange = (changes: CellChange[] | null, source: ChangeSource) => {
        if (this.state.numColumns <= 0 || !changes || changes.length === 0) return;
        const requiredChanges: [number, number, string | number | boolean | null][] = [];
        changes.forEach((change, index) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const [rowValue, colValue, _, newValue] = change;
            const col = this.state.getColumnObjectAtIndex(colValue as number);
            const isValidSpreadsheetBooleanValueAndRequiresChange =
                col &&
                col.type === EPropertyType.BOOLEAN &&
                newValue !== true &&
                newValue !== false &&
                newValue !== null;
            if (isValidSpreadsheetBooleanValueAndRequiresChange) {
                let transformedValue = null;
                switch (newValue) {
                    case '':
                    case null:
                        transformedValue = null;
                        break;
                    case 't':
                    case 'true':
                        transformedValue = true;
                        break;
                    default:
                        transformedValue = false;
                        break;
                }
                requiredChanges.push([rowValue, colValue as number, transformedValue]);
            }
        });

        if (requiredChanges.length > 0) this.state.ref?.setDataAtCell(requiredChanges);
    };
}

export default HotSettingsBuilder;
