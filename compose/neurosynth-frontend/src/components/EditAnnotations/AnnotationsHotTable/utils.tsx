import { EPropertyType } from 'components/EditMetadata';
import { NoteKeyType } from '../helpers/utils';
import styles from './AnnotationsHotTable.module.css';
import { numericValidator } from 'handsontable/validators';
import { CellValue } from 'handsontable/common';
import { ColumnSettings } from 'handsontable/settings';
import { renderToString } from 'react-dom/server';
import { Cancel } from '@mui/icons-material';

const booleanValidator = (value: CellValue, callback: (isValid: boolean) => void) => {
    const isValid =
        value === true ||
        value === false ||
        value === 'true' ||
        value === 'false' ||
        value === null ||
        value === '';
    callback(isValid);
};

export const createColumns = (noteKeys: NoteKeyType[]) => [
    {
        className: `${styles['study-col']} ${styles['read-only-col']}`,
        readOnly: true,
        width: '200',
    },
    {
        className: styles['read-only-col'],
        readOnly: true,
        width: '150',
    },
    ...noteKeys.map((x) => {
        return {
            readOnly: false,
            className: styles[x.type],
            allowInvalid: false,
            type: x.type === EPropertyType.BOOLEAN ? 'checkbox' : 'text',
            validator:
                x.type === EPropertyType.NUMBER
                    ? numericValidator
                    : x.type === EPropertyType.BOOLEAN
                    ? booleanValidator
                    : undefined,
        } as ColumnSettings;
    }),
];

export const createColumnHeader = (
    colKey: string,
    colType: EPropertyType,
    updateFunc?: (key: string) => void
) => {
    const allowRemove = updateFunc
        ? `<div style="width: 50px;">${renderToString(
              <Cancel
                  onClick={() => updateFunc(colKey)}
                  sx={{ ':hover': { color: 'error.light', cursor: 'pointer' } }}
                  color="error"
              />
          )}</div>`
        : '<div></div>';

    return (
        `<div style="display: flex; align-items: center; justify-content: center; min-width: 160px">` +
        `<div class=${styles[colType]}>${colKey}</div>` +
        allowRemove +
        `</div>`
    );
};
