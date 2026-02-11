import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
import { AnnotationNoteValue, NoteKeyType } from 'components/HotTables/HotTables.types';
import { CellValue } from 'handsontable/common';

export const noteKeyObjToArr = (noteKeys?: object | null): NoteKeyType[] => {
    if (!noteKeys) return [];
    const noteKeyTypes = noteKeys as {
        [key: string]: { type: EPropertyType; order?: number; default?: AnnotationNoteValue };
    };
    const arr = Object.entries(noteKeyTypes)
        .map(([key, descriptor]) => {
            if (!descriptor?.type) throw new Error('Invalid note_keys descriptor: missing type');
            return {
                type: descriptor.type,
                key,
                order: descriptor.order ?? 0,
                default: descriptor.default ?? null,
            };
        })
        .sort((a, b) => a.order - b.order || a.key.localeCompare(b.key))
        .map((noteKey, index) => ({ ...noteKey, order: index }));
    return arr;
};

export const noteKeyArrToObj = (
    noteKeyArr: NoteKeyType[]
): { [key: string]: { type: EPropertyType; order: number; default?: AnnotationNoteValue } } => {
    const noteKeyObj = noteKeyArr.reduce(
        (acc, curr, index) => {
            const descriptor: { type: EPropertyType; order: number; default?: AnnotationNoteValue } = {
                type: curr.type,
                order: curr.order ?? index,
                default: curr.default ?? null,
            };
            acc[curr.key] = descriptor;
            return acc;
        },
        {} as { [key: string]: { type: EPropertyType; order: number; default?: AnnotationNoteValue } }
    );

    return noteKeyObj;
};

export const getDefaultForNoteKey = (key: string, type: EPropertyType): AnnotationNoteValue | undefined => {
    if (type !== EPropertyType.BOOLEAN) return undefined;
    return key === 'included' ? true : false;
};

export const booleanValidator = (value: CellValue, callback: (isValid: boolean) => void) => {
    const isValid =
        value === true || value === false || value === 'true' || value === 'false' || value === null || value === '';
    callback(isValid);
};

export const replaceString = (val: string) => {
    // replace = ['֊', '‐', '‑', '⁃', '﹣', '－', '‒', '–', '—', '﹘', '−', '-']

    return val.replaceAll(new RegExp('֊|‐|‑|⁃|﹣|－|‒|–|—|﹘|−|-', 'g'), '-');
};

export const stripTags = (stringWhichMayHaveHTML: unknown) => {
    if (typeof stringWhichMayHaveHTML !== 'string') return '';

    const doc = new DOMParser().parseFromString(stringWhichMayHaveHTML, 'text/html');
    return doc.body.textContent || '';
};

export const sanitizePaste = (data: unknown[][]) => {
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
    return [first, second, ...noteKeys.map(() => (colWidth ? colWidth : 150))];
};
