import { Box, Checkbox, CircularProgress, TextField } from '@mui/material';
import type { CellContext } from '@tanstack/react-table';
import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
import React, { memo, useCallback, useEffect, useState } from 'react';
import type { AnalysisBoardRow } from '../hooks/useEditStudyAnalysisBoardState.types';
import { analysisRowsShallowEqual } from '../hooks/useEditStudyAnalysisBoardState.helpers';
import { STUDY_ANALYSIS_TABLE_ROW_MIN_HEIGHT_PX } from '../hooks/useEditStudyAnalysisBoardState.consts';

type AnnotationStoredValue = string | boolean | number | null | undefined;

const annotationValueToInputString = (value: AnnotationStoredValue): string =>
    value === undefined || value === null ? '' : String(value);

export const annotationStringToCommitted = (value: AnnotationStoredValue): string | null =>
    value === undefined || value === null || value === '' ? null : String(value);

export const annotationNumberToCommitted = (value: AnnotationStoredValue): number | null => {
    if (value === undefined || value === null || value === '') return null;
    const parsed = typeof value === 'number' ? value : Number(String(value).trim());
    return Number.isNaN(parsed) ? null : parsed;
};

export const parseAnnotationStringLocalCommit = (local: string): string | null =>
    local === '' ? null : local;

export type AnnotationNumberLocalCommitParseResult =
    | { kind: 'commit'; value: number | null }
    | { kind: 'invalid' };

export const parseAnnotationNumberLocalCommit = (local: string): AnnotationNumberLocalCommitParseResult => {
    const trimmed = local.trim();
    if (trimmed === '') return { kind: 'commit', value: null };
    const parsed = Number(trimmed);
    if (Number.isNaN(parsed)) return { kind: 'invalid' };
    return { kind: 'commit', value: parsed };
};

const cellSx = {
    minHeight: STUDY_ANALYSIS_TABLE_ROW_MIN_HEIGHT_PX,
    height: STUDY_ANALYSIS_TABLE_ROW_MIN_HEIGHT_PX,
    display: 'flex',
    overflow: 'hidden',
    flexDirection: 'column',
    p: 0.5,
    boxSizing: 'border-box',
};

const annotationMultilineInputSx = {
    height: '100%',
    width: '100%',
    '& .MuiTextField-root': {
        overflow: 'hidden !important',
    },
    '& .MuiInputBase-root': {
        overflow: 'hidden !important',
        height: '100%',
        padding: 0,
    },
    '& textarea': {
        overflow: 'auto !important',
        height: '100% !important',
        fontSize: '14px !important',
    },
};

const AnnotationNumberInputCell = memo(
    ({
        initialValue,
        onCommit,
    }: {
        initialValue: AnnotationStoredValue;
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
                    onChange={(event) => setLocal(event.target.value)}
                    onBlur={() => {
                        const parsed = parseAnnotationNumberLocalCommit(local);
                        if (parsed.kind === 'invalid') {
                            setLocal(annotationValueToInputString(initialValue));
                            return;
                        }
                        if (parsed.value !== annotationNumberToCommitted(initialValue)) {
                            onCommit(parsed.value);
                        }
                    }}
                    onClick={(event) => event.stopPropagation()}
                    fullWidth
                    multiline
                    minRows={2}
                    maxRows={6}
                    size="small"
                    variant="standard"
                    sx={annotationMultilineInputSx}
                    inputProps={{ className: 'sleek-scrollbar' }}
                    InputProps={{ disableUnderline: true, sx: { height: '100%', fontSize: '14px !important' } }}
                />
            </Box>
        );
    },
    (prev, next) => prev.initialValue === next.initialValue,
);

const AnnotationStringInputCell = memo(
    ({
        initialValue,
        onCommit,
    }: {
        initialValue: AnnotationStoredValue;
        onCommit: (value: string | boolean | number | null) => void | Promise<void>;
    }) => {
        const [local, setLocal] = useState(() => annotationValueToInputString(initialValue));

        useEffect(() => {
            setLocal(annotationValueToInputString(initialValue));
        }, [initialValue]);

        const handleBlur = (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const committed = parseAnnotationStringLocalCommit(local);
            if (committed !== annotationStringToCommitted(initialValue)) {
                onCommit(committed);
            }
            const element = event.target as HTMLTextAreaElement;
            element.scrollTop = 0;
            element.scrollLeft = 0;
        };

        return (
            <Box sx={cellSx}>
                <TextField
                    value={local}
                    onChange={(event) => setLocal(event.target.value)}
                    onBlur={handleBlur}
                    onClick={(event) => event.stopPropagation()}
                    fullWidth
                    multiline
                    minRows={2}
                    maxRows={6}
                    size="small"
                    variant="standard"
                    inputProps={{ className: 'sleek-scrollbar' }}
                    InputProps={{ disableUnderline: true }}
                    sx={annotationMultilineInputSx}
                />
            </Box>
        );
    },
    (prev, next) => prev.initialValue === next.initialValue,
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

    const [isEditing, setIsEditing] = useState(false);

    const handleCommit = useCallback(
        async (committed: string | boolean | number | null) => {
            if (!columnNoteKey || !row.original.id) return;
            try {
                setIsEditing(true);
                await onUpdateAnnotation?.({
                    analysisId: row.original.id,
                    columnKey: columnNoteKey.key,
                    value: committed,
                });
            } catch (error) {
                console.error(error);
            } finally {
                setIsEditing(false);
            }
        },
        [columnNoteKey, onUpdateAnnotation, row.original.id],
    );

    if (isEditing) {
        return (
            <Box
                sx={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
            >
                <CircularProgress size={20} />
            </Box>
        );
    }

    if (columnNoteKey?.type === EPropertyType.BOOLEAN) {
        return (
            <Box sx={{ ...cellSx, justifyContent: 'center', alignItems: 'center' }}>
                <Checkbox
                    checked={Boolean(value)}
                    size="medium"
                    onClick={(event) => event.stopPropagation()}
                    inputProps={{
                        'aria-label': columnNoteKey.key,
                    }}
                    onChange={(event) => {
                        handleCommit(event.target.checked);
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
        prev.getValue() === next.getValue(),
);
