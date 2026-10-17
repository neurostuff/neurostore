import { Button, Stack } from '@mui/material';
import type { ReactNode } from 'react';
import { panelKeys } from '../inspector/panelKeys';
import { usePointDraft } from './pointDraft';
import { PointFields } from './PointFields';

type Point = Record<string, unknown>;

export interface PointEditorProps {
    label: string;
    /** The point as the revision holds it; null for a new point. */
    point: Point | null;
    onSave(point: Point | null): void;
    onCancel(): void;
    saveLabel?: string;
    /** Whether the point's first field takes the focus. */
    autoFocus?: boolean;
    /** Fields shown above the point's, which the caller saves with it. */
    children?: ReactNode;
    /** Whether the point's fields are left out, the save giving no point. */
    withoutPoint?: boolean;
}

/** An editor for one coordinate point, generated from the schema's point fields. */
export function PointEditor({
    label,
    point,
    onSave,
    onCancel,
    saveLabel = 'Save',
    autoFocus = true,
    children,
    withoutPoint = false,
}: PointEditorProps) {
    const draft = usePointDraft(point);
    const save = () => {
        if (withoutPoint) return onSave(null);
        const next = draft.build();
        if (next) onSave(next);
    };

    return (
        <Stack
            role="group"
            aria-label={`edit ${label}`}
            spacing={1.5}
            sx={{ py: 1 }}
            onKeyDown={panelKeys(save, onCancel)}
        >
            {children}
            {!withoutPoint && <PointFields draft={draft} autoFocus={autoFocus} />}
            <Stack direction="row" spacing={1}>
                <Button size="small" variant="contained" onClick={save}>
                    {saveLabel}
                </Button>
                <Button size="small" onClick={onCancel}>
                    Cancel
                </Button>
            </Stack>
        </Stack>
    );
}
