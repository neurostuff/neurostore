import CellCoords from 'handsontable/3rdparty/walkontable/src/cell/coords';
import { CellChange, ChangeSource } from 'handsontable/common';
import { htmlRenderer } from 'handsontable/renderers';
import { CellMeta, GridSettings } from 'handsontable/settings';
import { EPropertyType } from '..';
import styles from './NeurosynthSpreadsheet.module.css';
import { NeurosynthSpreadsheetHelper } from './NeurosynthSpreadsheetHelper';
import NeurosynthSpreadsheetState from './NeurosynthSpreadsheetState';

class HotSettingsBuilder {
    private state;

    private data = [[]];
    private mergeCells = [];
    private stretchH: 'all' | 'none' | 'last' | undefined = 'all';
    private rowHeaderWidth = NeurosynthSpreadsheetHelper.ROW_HEADER_WIDTH;
    private rowHeights = NeurosynthSpreadsheetHelper.ROW_HEIGHTS;
    private height = '70px';
    private fillHandle = false;
    private contextMenu = false;
    private licenseKey = 'non-commercial-and-evaluation';
    private viewportColumnRenderingOffset = 9;
    private viewportRowRenderingOffset = 9;
    private renderAllRows = false;

    constructor(state: NeurosynthSpreadsheetState) {
        this.state = state;
    }

    public getBaseHotSettings(): GridSettings {
        return {
            data: this.data,
            mergeCells: this.mergeCells,
            stretchH: this.stretchH,
            rowHeaderWidth: this.rowHeaderWidth,
            rowHeights: this.rowHeights,
            height: this.height,
            fillHandle: this.fillHandle,
            contextMenu: this.contextMenu,
            licenseKey: this.licenseKey,
            viewportColumnRenderingOffset: this.viewportColumnRenderingOffset,
            viewportRowRenderingOffset: this.viewportRowRenderingOffset,
            renderAllRows: this.renderAllRows,

            afterGetColHeader: this.afterGetColHeader,
            afterGetRowHeader: this.afterGetRowHeader,
            afterRefreshDimensions: this.afterRefreshDimensions,
            afterOnCellMouseUp: this.afterOnCellMouseUp,
            cells: this.cells,
            beforeOnCellMouseDown: this.beforeOnCellMouseDown,
            afterChange: this.afterChange,
        };
    }

    private afterGetColHeader = (column: number, TH: HTMLElement): void => {
        const isBoolType = TH.querySelector(`.${styles.boolean}`);
        if (TH && isBoolType) {
            TH.setAttribute(
                'title',
                'valid boolean entries include "t" or "true" for true and "f" or "false" for false.'
            );
        }
    };

    private afterGetRowHeader = (row: number, TH: HTMLElement): void => {
        if (this.state.rowIsStudyTitle(row)) {
            TH.setAttribute(
                'style',
                'background-color: #ccc; color: black; border-left-color: #ccc; border-right-color: #ccc;'
            );
        }
    };

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

    private afterOnCellMouseUp = (
        event: MouseEvent,
        coords: CellCoords,
        TD: HTMLTableCellElement
    ): void => {
        const target = event.target as HTMLButtonElement;
        if (target.tagName === 'svg' || (target.tagName === 'path' && coords.row < 0)) {
            this.state.removeColumnAtIndex(coords.col);
        }
    };

    private cells = (row: number, column: number, prop: string | number): CellMeta => {
        const cellProperties: any = {};
        if (this.state.rowIsStudyTitle(row)) {
            cellProperties.readOnly = true;
            cellProperties.renderer = htmlRenderer;
            cellProperties.className = styles['study-details-row'];
        }
        return cellProperties;
    };

    private beforeOnCellMouseDown = (event: MouseEvent, coords: CellCoords, TH: HTMLElement) => {
        // Prevent study name from being selectable and copyable
        if (this.state.rowIsStudyTitle(coords.row)) event.stopImmediatePropagation();
    };

    private afterChange = (changes: CellChange[] | null, source: ChangeSource) => {
        if (this.state.numColumns <= 0 || !changes) return;
        const requiredChanges: [number, number, string | number | boolean | null][] = [];
        changes.forEach((change, index) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const [rowValue, colValue, _, newValue] = change;
            const col = this.state.getColumnObjectAtIndex(colValue as number);
            const isValidSpreadsheetBooleanValueAndRequiresChange =
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

        this.state.ref?.setDataAtCell(requiredChanges);
    };
}

export default HotSettingsBuilder;
