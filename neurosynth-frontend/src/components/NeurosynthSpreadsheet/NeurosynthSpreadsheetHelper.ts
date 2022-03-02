import styles from './NeurosynthSpreadsheet.module.css';

class NeurosynthSpreadsheetHelper {
    public static readonly ROW_HEADER_WIDTH = 200;
    public static readonly ROW_HEIGHTS = 25;
    public static readonly COL_WIDTHS = 160;

    public static IsSpreadsheetBoolType(value: any): boolean {
        return (
            value === 't' ||
            value === 'f' ||
            value === 'true' ||
            value === 'false' ||
            value === null ||
            value === true ||
            value === false ||
            value === ''
        );
    }

    public static GetVisibleStudyTitleWidth(): number {
        const screenWidth = window.innerWidth;
        const parentPadding = 20;
        const scrollbarAdjustment = 20;

        // all page content is 80% of parent
        return Math.floor(
            screenWidth * 0.8 -
                parentPadding -
                NeurosynthSpreadsheetHelper.ROW_HEADER_WIDTH -
                scrollbarAdjustment
        );
    }

    public static BuildStudyDisplayText(
        studyName: string,
        studyYear: number | undefined,
        authors: string,
        journalName: string,
        isHTML: boolean
    ): string {
        let authorText = '';
        authorText = authors.split(', ')[0];
        if (authors.split(', ').length > 1) authorText += ' et al.,';
        const studyNameText = studyYear ? `(${studyYear}) ${studyName}` : studyName;
        const visibleWidth = NeurosynthSpreadsheetHelper.GetVisibleStudyTitleWidth();
        return isHTML
            ? `<div style="width: ${visibleWidth}px;" class="${styles['study-details-row-content']}">` +
                  `<span class="${styles.authors} ${styles['study-details-text']}">${authorText}</span>` +
                  `<span class="${styles['study-name']} ${styles['study-details-text']}">${studyNameText}</span>` +
                  `<span class="${styles.publication} ${styles['study-details-text']}">${journalName}</span>` +
                  `</div>`
            : `${authorText} | ${studyNameText} | ${journalName}`;
    }
}

export default NeurosynthSpreadsheetHelper;
