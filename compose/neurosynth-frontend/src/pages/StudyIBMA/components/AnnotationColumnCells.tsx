import { Box, Checkbox, TextField } from '@mui/material';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { STUDY_ANALYSIS_TABLE_ROW_MIN_HEIGHT_PX } from './editStudyAnalysisBoard.constants';
import type { AnalysisBoardRowKind } from './editStudyAnalysisBoard.types';

function annotationValueToInputString(v: string | boolean | number | null | undefined): string {
    return v === undefined || v === null ? '' : String(v);
}

const annotationInvisibleTextFieldSx = {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
    '& .MuiOutlinedInput-root': {
        height: 'auto',
        alignItems: 'flex-start',
        backgroundColor: 'transparent',
        '& fieldset': { border: 'none' },
        '&:hover fieldset': { border: 'none' },
        '&.Mui-focused fieldset': { border: 'none' },
        '&.Mui-disabled fieldset': { border: 'none' },
    },
    '& .MuiOutlinedInput-notchedOutline': {
        border: 'none',
    },
    '& .MuiInputBase-input': {
        py: 0.5,
        px: 0,
        height: 'auto',
        boxSizing: 'border-box',
        typography: 'body2',
        color: 'text.primary',
        textAlign: 'left',
    },
    '& .MuiInputBase-input::placeholder': {
        color: 'text.disabled',
        opacity: 1,
    },
    '& input[type=number]': {
        MozAppearance: 'textfield',
        textAlign: 'left',
        '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': {
            WebkitAppearance: 'none',
            margin: 0,
        },
    },
} as const;

const annotationInvisibleMultilineTextFieldSx = {
    ...annotationInvisibleTextFieldSx,
    '& .MuiOutlinedInput-root': {
        ...annotationInvisibleTextFieldSx['& .MuiOutlinedInput-root'],
        alignItems: 'flex-start',
    },
    '& .MuiInputBase-input': {
        ...annotationInvisibleTextFieldSx['& .MuiInputBase-input'],
        height: 'auto !important',
        minHeight: 0,
        verticalAlign: 'top',
        textAlign: 'left',
    },
    '& textarea.MuiInputBase-input': {
        padding: 0,
        overflowX: 'hidden',
    },
    '& .MuiOutlinedInput-root:not(.Mui-focused) textarea.MuiInputBase-input': {
        overflowY: 'hidden !important',
    },
    '& .MuiOutlinedInput-root.Mui-focused textarea.MuiInputBase-input': {
        overflowY: 'auto !important',
        scrollbarGutter: 'stable',
    },
} as const;

const AnnotationNumberInputCell = memo(
    function AnnotationNumberInputCell({
        rowId,
        field,
        initialValue,
        onCommit,
        fullCellSx,
    }: {
        rowId: string;
        field: string;
        initialValue: string | boolean | number | null | undefined;
        onCommit: (rowId: string, field: string, v: string | boolean | number) => void;
        fullCellSx: Record<string, unknown>;
    }) {
        const [local, setLocal] = useState(() => annotationValueToInputString(initialValue));
        useEffect(() => {
            setLocal(annotationValueToInputString(initialValue));
        }, [initialValue]);

        return (
            <Box sx={fullCellSx}>
                <TextField
                    type="number"
                    value={local}
                    onChange={(e) => setLocal(e.target.value)}
                    onBlur={() => {
                        const v = local.trim();
                        if (v === '') {
                            onCommit(rowId, field, 0);
                            return;
                        }
                        const n = Number(v);
                        if (!Number.isNaN(n)) onCommit(rowId, field, n);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    fullWidth
                    size="small"
                    variant="outlined"
                    sx={annotationInvisibleTextFieldSx}
                />
            </Box>
        );
    },
    (prev, next) => prev.rowId === next.rowId && prev.field === next.field && prev.initialValue === next.initialValue
);

const AnnotationStringInputCell = memo(
    function AnnotationStringInputCell({
        rowId,
        field,
        initialValue,
        onCommit,
        fullCellSx,
    }: {
        rowId: string;
        field: string;
        initialValue: string | boolean | number | null | undefined;
        onCommit: (rowId: string, field: string, v: string | boolean | number) => void;
        fullCellSx: Record<string, unknown>;
    }) {
        const [local, setLocal] = useState(() => annotationValueToInputString(initialValue));
        useEffect(() => {
            setLocal(annotationValueToInputString(initialValue));
        }, [initialValue]);

        const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            onCommit(rowId, field, local);
            const el = e.target as HTMLTextAreaElement;
            el.scrollTop = 0;
            el.scrollLeft = 0;
        };

        return (
            <Box sx={fullCellSx}>
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
                    variant="outlined"
                    sx={annotationInvisibleMultilineTextFieldSx}
                />
            </Box>
        );
    },
    (prev, next) => prev.rowId === next.rowId && prev.field === next.field && prev.initialValue === next.initialValue
);

export const AnnotationColumnCell = memo(
    function AnnotationColumnCell({
        rowId,
        rowKind,
        field,
        type,
        headerLabel,
        initialValue,
        onCommit,
    }: {
        rowId: string;
        rowKind: AnalysisBoardRowKind;
        field: string;
        type: 'boolean' | 'string' | 'number';
        headerLabel: string;
        initialValue: string | boolean | number | null | undefined;
        onCommit: (rowId: string, field: string, v: string | boolean | number) => void;
    }) {
        if (rowKind === 'detail') {
            return (
                <Box
                    aria-hidden
                    sx={{
                        width: '100%',
                        minHeight: STUDY_ANALYSIS_TABLE_ROW_MIN_HEIGHT_PX,
                        bgcolor: 'transparent',
                        pointerEvents: 'none',
                        userSelect: 'none',
                    }}
                />
            );
        }

        const fullCellSx = {
            width: '100%',
            minHeight: STUDY_ANALYSIS_TABLE_ROW_MIN_HEIGHT_PX,
            display: 'flex',
            flexDirection: 'column' as const,
            alignItems: 'stretch',
            justifyContent: 'flex-start',
            boxSizing: 'border-box' as const,
            p: 0.5,
        };

        if (type === 'boolean') {
            return (
                <Box sx={{ ...fullCellSx, justifyContent: 'center', alignItems: 'center' }}>
                    <Checkbox
                        checked={Boolean(initialValue)}
                        size="small"
                        onChange={(_, c) => onCommit(rowId, field, c)}
                        onClick={(e) => e.stopPropagation()}
                        inputProps={{
                            'aria-label': headerLabel,
                        }}
                    />
                </Box>
            );
        }

        if (type === 'number') {
            return (
                <AnnotationNumberInputCell
                    rowId={rowId}
                    field={field}
                    initialValue={initialValue}
                    onCommit={onCommit}
                    fullCellSx={fullCellSx}
                />
            );
        }

        return (
            <AnnotationStringInputCell
                rowId={rowId}
                field={field}
                initialValue={initialValue}
                onCommit={onCommit}
                fullCellSx={fullCellSx}
            />
        );
    },
    (prev, next) =>
        prev.rowId === next.rowId &&
        prev.rowKind === next.rowKind &&
        prev.field === next.field &&
        prev.type === next.type &&
        prev.headerLabel === next.headerLabel &&
        prev.initialValue === next.initialValue
);

/** Stable callback wrapper for memoized cells */
export function useStableAnnotationColumnCommit(
    onCommit: (rowId: string, field: string, value: string | boolean | number) => void
) {
    const ref = useRef(onCommit);
    ref.current = onCommit;
    return useCallback((rowId: string, field: string, value: string | boolean | number) => {
        ref.current(rowId, field, value);
    }, []);
}
