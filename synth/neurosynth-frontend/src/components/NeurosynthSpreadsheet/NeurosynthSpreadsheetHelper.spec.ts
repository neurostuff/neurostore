import NeurosynthSpreadsheetHelper from './NeurosynthSpreadsheetHelper';

describe('NeurosynthSpreadsheetHelper', () => {
    it('should call IsSpreadsheetBoolType to correctly determine the correct spreadsheet type', () => {
        expect(NeurosynthSpreadsheetHelper.IsSpreadsheetBoolType('t')).toBeTruthy();
        expect(NeurosynthSpreadsheetHelper.IsSpreadsheetBoolType('true')).toBeTruthy();
        expect(NeurosynthSpreadsheetHelper.IsSpreadsheetBoolType('f')).toBeTruthy();
        expect(NeurosynthSpreadsheetHelper.IsSpreadsheetBoolType('false')).toBeTruthy();
        expect(NeurosynthSpreadsheetHelper.IsSpreadsheetBoolType(null)).toBeTruthy();
        expect(NeurosynthSpreadsheetHelper.IsSpreadsheetBoolType(true)).toBeTruthy();
        expect(NeurosynthSpreadsheetHelper.IsSpreadsheetBoolType(false)).toBeTruthy();
        expect(NeurosynthSpreadsheetHelper.IsSpreadsheetBoolType('')).toBeTruthy();

        expect(NeurosynthSpreadsheetHelper.IsSpreadsheetBoolType('random-string')).toBeFalsy();
    });

    it('should call GetVisibleStudyTitleWidth to get the correct Study Title Width', () => {
        window.innerWidth = 500;
        expect(NeurosynthSpreadsheetHelper.GetVisibleStudyTitleWidth()).toEqual(160);
    });

    describe('BuildStudyDisplayText', () => {
        window.innerWidth = 500;
        const mockStudyName = 'Some long test study name';
        const mockStudyYear = 2020;
        const mockAuthors = 'Edwards Jonathan, Cutter Jane, Potter Phillip';
        const mockJournalName = 'NeuroJournal';

        it('should build the correct HTML with the given study information', () => {
            const builtHTML = NeurosynthSpreadsheetHelper.BuildStudyDisplayText(
                mockStudyName,
                mockStudyYear,
                mockAuthors,
                mockJournalName,
                true
            );

            expect(builtHTML).toEqual(
                `<div style="width: 160px;" class="study-details-row-content">` +
                    `<span class="authors study-details-text">Edwards Jonathan et al.,</span>` +
                    `<span class="study-name study-details-text">(2020) Some long test study name</span>` +
                    `<span class="publication study-details-text">NeuroJournal</span>` +
                    `</div>`
            );
        });

        it('should build the correct HTML when the year is undefined', () => {
            const builtHTML = NeurosynthSpreadsheetHelper.BuildStudyDisplayText(
                mockStudyName,
                undefined,
                mockAuthors,
                mockJournalName,
                true
            );

            expect(builtHTML).toEqual(
                `<div style="width: 160px;" class="study-details-row-content">` +
                    `<span class="authors study-details-text">Edwards Jonathan et al.,</span>` +
                    `<span class="study-name study-details-text">Some long test study name</span>` +
                    `<span class="publication study-details-text">NeuroJournal</span>` +
                    `</div>`
            );
        });

        it('should build the correct string given the study information', () => {
            const builtString = NeurosynthSpreadsheetHelper.BuildStudyDisplayText(
                mockStudyName,
                mockStudyYear,
                mockAuthors,
                mockJournalName,
                false
            );

            expect(builtString).toEqual(
                `Edwards Jonathan et al., | (2020) Some long test study name | NeuroJournal`
            );
        });

        it('should build the correct string when the year is undefined', () => {
            const builtString = NeurosynthSpreadsheetHelper.BuildStudyDisplayText(
                mockStudyName,
                undefined,
                mockAuthors,
                mockJournalName,
                false
            );

            expect(builtString).toEqual(
                `Edwards Jonathan et al., | Some long test study name | NeuroJournal`
            );
        });
    });
});
