import { Box, Checkbox, TextField } from '@mui/material';
import type { CellContext } from '@tanstack/react-table';
import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
import React, { memo, useCallback, useEffect, useState } from 'react';
import type { AnalysisBoardRow } from '../hooks/useEditStudyAnalysisBoardState.types';
import { analysisRowsShallowEqual } from '../hooks/useEditStudyAnalysisBoardState.helpers';
import { STUDY_ANALYSIS_TABLE_ROW_MIN_HEIGHT_PX } from '../hooks/useEditStudyAnalysisBoardState.consts';

const annotationValueToInputString = (v: string | boolean | number | null | undefined): string =>
    v === undefined || v === null ? '' : String(v);

const cellSx = {
    minHeight: STUDY_ANALYSIS_TABLE_ROW_MIN_HEIGHT_PX,
    height: STUDY_ANALYSIS_TABLE_ROW_MIN_HEIGHT_PX,
    display: 'flex',
    flexDirection: 'column',
    p: 0.5,
    boxSizing: 'border-box',
};

const annotationInputSx = {
    flex: 1,
    minWidth: 0,
    '& .MuiInputBase-input': { typography: 'body2', py: 0.5, px: 0 },
    '& input[type=number]': {
        MozAppearance: 'textfield',
        '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { WebkitAppearance: 'none', m: 0 },
    },
};

const annotationMultilineInputSx = {
    ...annotationInputSx,
    '& textarea.MuiInputBase-input': { p: 0, overflowX: 'hidden' },
    '& .MuiInput-root:not(.Mui-focused) textarea': { overflowY: 'hidden' },
    '& .MuiInput-root.Mui-focused textarea': { overflowY: 'auto', scrollbarGutter: 'stable' },
};

const AnnotationNumberInputCell = memo(
    ({
        initialValue,
        onCommit,
    }: {
        initialValue: string | boolean | number | null | undefined;
        onCommit: (value: string | boolean | number | null) => void;
    }) => {
        const [local, setLocal] = useState(() => annotationValueToInputString(initialValue));
        useEffect(() => {
            setLocal(annotationValueToInputString(initialValue));
        }, [initialValue]);

        return (
            <Box sx={cellSx}>
                <TextField
                    type="number"
                    value={local}
                    onChange={(e) => setLocal(e.target.value)}
                    onBlur={() => {
                        const trimmed = local.trim();
                        if (trimmed === '') {
                            onCommit(null);
                            return;
                        }
                        const parsed = Number(trimmed);
                        if (!Number.isNaN(parsed)) onCommit(parsed);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    fullWidth
                    size="small"
                    variant="standard"
                    InputProps={{ disableUnderline: true }}
                    sx={annotationInputSx}
                />
            </Box>
        );
    },
    (prev, next) => prev.initialValue === next.initialValue
);

const AnnotationStringInputCell = memo(
    ({
        initialValue,
        onCommit,
    }: {
        initialValue: string | boolean | number | null | undefined;
        onCommit: (value: string | boolean | number | null) => void;
    }) => {
        const [local, setLocal] = useState(() => annotationValueToInputString(initialValue));
        useEffect(() => {
            setLocal(annotationValueToInputString(initialValue));
        }, [initialValue]);

        const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            onCommit(local === '' ? null : local);
            const el = e.target as HTMLTextAreaElement;
            el.scrollTop = 0;
            el.scrollLeft = 0;
        };

        return (
            <Box sx={cellSx}>
                <TextField
                    value={local}
                    onChange={(e) => setLocal(e.target.value)}
                    onBlur={handleBlur}
                    onClick={(e) => e.stopPropagation()}
                    fullWidth
                    multiline
                    minRows={2}
                    maxRows={6}
                    size="small"
                    variant="standard"
                    InputProps={{ disableUnderline: true }}
                    sx={annotationMultilineInputSx}
                />
            </Box>
        );
    },
    (prev, next) => prev.initialValue === next.initialValue
);

const AnnotationBaseInputCell: React.FC<CellContext<AnalysisBoardRow, string | boolean | number | null>> = ({
    row,
    getValue,
    column,
    table,
}) => {
    const value = getValue();
    const columnNoteKey = column.columnDef.meta?.editStudyAnalysisTableNoteKey;
    const onUpdateAnnotation = table.options.meta?.updateAnnotationCell;

    const handleCommit = useCallback(
        (committed: string | boolean | number | null) => {
            if (!columnNoteKey || !row.original.id) return;
            void onUpdateAnnotation?.({
                analysisId: row.original.id,
                columnKey: columnNoteKey.key,
                value: committed,
            });
        },
        [columnNoteKey, onUpdateAnnotation, row.original.id]
    );

    if (columnNoteKey?.type === EPropertyType.BOOLEAN) {
        return (
            <Box sx={{ ...cellSx, justifyContent: 'center', alignItems: 'center' }}>
                <Checkbox
                    checked={Boolean(value)}
                    size="small"
                    onClick={(e) => e.stopPropagation()}
                    inputProps={{
                        'aria-label': columnNoteKey.key,
                    }}
                    onChange={(e) => {
                        handleCommit(e.target.checked);
                    }}
                />
            </Box>
        );
    }

    if (columnNoteKey?.type === EPropertyType.NUMBER) {
        return <AnnotationNumberInputCell initialValue={value} onCommit={handleCommit} />;
    }

    return <AnnotationStringInputCell initialValue={value} onCommit={handleCommit} />;
};

export default memo(
    AnnotationBaseInputCell,
    (prev, next) =>
        analysisRowsShallowEqual(prev.row.original, next.row.original) &&
        prev.column.id === next.column.id &&
        prev.getValue() === next.getValue()
);
