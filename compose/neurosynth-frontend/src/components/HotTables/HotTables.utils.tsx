import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
import { NoteKeyType } from 'components/HotTables/HotTables.types';
import { CellValue } from 'handsontable/common';

export const noteKeyObjToArr = (noteKeys?: object | null): NoteKeyType[] => {
    if (!noteKeys) return [];
    const noteKeyTypes = noteKeys as { [key: string]: EPropertyType };
    const arr = Object.entries(noteKeyTypes).map(([key, type]) => ({
        key,
        type,
    }));
    return arr;
};

export const noteKeyArrToObj = (noteKeyArr: NoteKeyType[]): { [key: string]: EPropertyType } => {
    const noteKeyObj: { [key: string]: EPropertyType } = noteKeyArr.reduce((acc, curr) => {
        acc[curr.key] = curr.type;
        return acc;
    }, {} as { [key: string]: EPropertyType });

    return noteKeyObj;
};

export const booleanValidator = (value: CellValue, callback: (isValid: boolean) => void) => {
    const isValid =
        value === true ||
        value === false ||
        value === 'true' ||
        value === 'false' ||
        value === null ||
        value === '';
    callback(isValid);
};

export const replaceString = (val: string) => {
    // replace = ['֊', '‐', '‑', '⁃', '﹣', '－', '‒', '–', '—', '﹘', '−', '-']

    return val.replaceAll(new RegExp('֊|‐|‑|⁃|﹣|－|‒|–|—|﹘|−|-', 'g'), '-');
};

export const stripTags = (stringWhichMayHaveHTML: any) => {
    if (typeof stringWhichMayHaveHTML !== 'string') return '';

    let doc = new DOMParser().parseFromString(stringWhichMayHaveHTML, 'text/html');
    return doc.body.textContent || '';
};

export const sanitizePaste = (data: any[][]) => {
    data.forEach((dataRow, rowIndex) => {
        dataRow.forEach((value, valueIndex) => {
            if (typeof value === 'number') return;
            if (typeof value === 'boolean') return;

            let newVal = value;
            newVal = stripTags(newVal); // strip all HTML tags that were copied over if they exist
            newVal = replaceString(newVal); // replace minus operator with javascript character code

            if (newVal === 'true') newVal = true;
            else if (newVal === 'false') newVal = false;
            data[rowIndex][valueIndex] = newVal;
        });
    });
};

export const createColWidths = (
    noteKeys: NoteKeyType[],
    first: number,
    second: number,
    colWidth?: number
): number[] => {
    return [first, second, ...noteKeys.map((x) => (colWidth ? colWidth : 150))];
};
