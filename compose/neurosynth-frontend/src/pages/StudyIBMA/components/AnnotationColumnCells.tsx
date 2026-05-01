import { Box, Checkbox, TextField } from '@mui/material';
import type { CellContext } from '@tanstack/react-table';
import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
import React, { memo, useCallback, useEffect, useState } from 'react';
import { useUpdateAnnotationNotes } from 'stores/annotation/AnnotationStore.actions';
import { useAnnotationStore } from 'stores/annotation/AnnotationStore';
import type { AnalysisBoardRow } from '../hooks/useEditStudyAnalysisBoardState.types';
import { analysisRowsShallowEqual } from '../hooks/useEditStudyAnalysisBoardState.helpers';
import { STUDY_ANALYSIS_TABLE_ROW_MIN_HEIGHT_PX } from './editStudyAnalysisBoard.constants';

const annotationValueToInputString = (v: string | boolean | number | null | undefined): string =>
    v === undefined || v === null ? '' : String(v);

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
            <Box sx={fullCellSx}>
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
                    variant="outlined"
                    sx={annotationInvisibleTextFieldSx}
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
    (prev, next) => prev.initialValue === next.initialValue
);

export const AnnotationColumnCell: React.FC<CellContext<AnalysisBoardRow, string | boolean | number | null>> = memo(
    ({ row, getValue, column }) => {
        const updateNotes = useUpdateAnnotationNotes();
        const value = getValue();
        const columnNoteKey = column.columnDef.meta?.editStudyAnalysisTableNoteKey;

        const handleCommit = useCallback(
            (committed: string | boolean | number | null) => {
                if (!columnNoteKey) return;
                const analysisId = row.original.id;
                const currentNotes = useAnnotationStore.getState().annotation.notes ?? [];
                updateNotes(
                    currentNotes.map((note) =>
                        note.analysis === analysisId
                            ? {
                                  ...note,
                                  note: {
                                      ...(note.note as Record<string, string | boolean | number | null>),
                                      [columnNoteKey.key]: committed,
                                  },
                                  isEdited: true,
                              }
                            : note
                    )
                );
            },
            [columnNoteKey, row.original.id, updateNotes]
        );

        if (columnNoteKey?.type === EPropertyType.BOOLEAN) {
            return (
                <Box sx={{ ...fullCellSx, justifyContent: 'center', alignItems: 'center' }}>
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
    },
    (prev, next) =>
        analysisRowsShallowEqual(prev.row.original, next.row.original) &&
        prev.column.id === next.column.id &&
        prev.getValue() === next.getValue()
);
