import { Box, Button, Chip, FormControlLabel, Stack, Switch, TextField } from '@mui/material';
import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import type { SetValueOp } from '../contract/generated/review-ops';
import { inWords } from '../model/labels';
import type { ExtractedValue } from '../model/record';
import { panelKeys } from './panelKeys';
import { RemoveIcon } from './RemoveIcon';
import { inferredEditor, parseScalar, wrapperSpec, type EditorSpec, type Parsed, textOf, type Scalar } from './schema';
import type { Schema } from '../model/schema';

type SetValue = SetValueOp['value'];

const STATUS_WORDS: Record<string, string> = { extracted: 'reported', not_reported: 'not reported' };
const SOURCE_WORDS: Record<string, string> = {
    reported: 'as the paper states it',
    generated: 'worked out from the paper',
};
/** The schema's reasons in words, with the empty choice named. */
const reasonWords = (reasons: string[]) => ({
    '': 'no reason given',
    ...Object.fromEntries(reasons.map((reason) => [reason, inWords(reason)])),
});

export interface SlotEditorProps {
    label: string;
    /** The value wrapper's schema; its refs resolve against `root`. */
    schema: Schema;
    root?: Schema;
    value: ExtractedValue | undefined;
    mode: 'edit' | 'not_reported';
    onSave(value: SetValue): void;
    onCancel(): void;
}

function NativeSelect({
    id,
    label,
    value,
    options,
    onChange,
    autoFocus = false,
    labels = {},
    error = '',
    fullWidth = false,
}: {
    id: string;
    label: string;
    value: string;
    options: string[];
    onChange(value: string): void;
    autoFocus?: boolean;
    labels?: Record<string, string>;
    error?: string;
    fullWidth?: boolean;
}) {
    return (
        <TextField
            id={id}
            select
            size="small"
            fullWidth={fullWidth}
            label={label}
            value={value}
            autoFocus={autoFocus}
            error={error !== ''}
            helperText={error || undefined}
            onChange={(event) => onChange(event.target.value)}
            SelectProps={{ native: true }}
        >
            {options.map((option) => (
                <option key={option} value={option}>
                    {labels[option] ?? option}
                </option>
            ))}
        </TextField>
    );
}

interface FieldProps {
    id: string;
    label: string;
    error: string;
    autoFocus: boolean;
}

function SwitchField({
    id,
    label,
    value,
    autoFocus,
    onChange,
}: FieldProps & { value: string; onChange(value: string): void }) {
    const [checked, setChecked] = useState(value === 'true');
    return (
        <FormControlLabel
            label={label}
            control={
                <Switch
                    id={id}
                    checked={checked}
                    autoFocus={autoFocus}
                    onChange={(event) => {
                        setChecked(event.target.checked);
                        onChange(String(event.target.checked));
                    }}
                    inputProps={{ role: 'switch' }}
                />
            }
        />
    );
}

/** An editor for one scalar of `spec`; an optional closed choice can be left empty. */
export function ScalarField({
    spec,
    value,
    onChange,
    optional = false,
    ...field
}: FieldProps & { spec: Scalar; value: string; onChange(value: string): void; optional?: boolean }) {
    const { id, label, error, autoFocus } = field;
    if (spec.kind === 'boolean') return <SwitchField {...field} value={value} onChange={onChange} />;
    if (spec.kind === 'enum' && !spec.open) {
        const options = value === '' || spec.options.includes(value) ? spec.options : [value, ...spec.options];
        return (
            <NativeSelect
                id={id}
                label={label}
                value={value}
                options={value === '' || optional ? ['', ...options] : options}
                error={error}
                fullWidth
                autoFocus={autoFocus}
                onChange={onChange}
            />
        );
    }
    const number = spec.kind === 'number';
    const listId = `${id}-options`;
    return (
        <>
            <TextField
                id={id}
                size="small"
                fullWidth
                label={label}
                type={number ? 'number' : 'text'}
                value={value}
                error={error !== ''}
                helperText={error || undefined}
                autoFocus={autoFocus}
                onChange={(event) => onChange(event.target.value)}
                inputProps={
                    number
                        ? { min: spec.minimum, max: spec.maximum, step: spec.integer ? 1 : 'any' }
                        : spec.kind === 'enum'
                          ? { list: listId }
                          : { minLength: spec.minLength, maxLength: spec.maxLength }
                }
            />
            {spec.kind === 'enum' && (
                <datalist id={listId}>
                    {spec.options.map((option) => (
                        <option key={option} value={option} />
                    ))}
                </datalist>
            )}
        </>
    );
}

function ListField({
    id,
    label,
    items,
    draft,
    error,
    autoFocus,
    onDraft,
    onRemove,
}: FieldProps & {
    items: unknown[];
    draft: string;
    onDraft(value: string): void;
    onRemove(index: number): void;
}) {
    return (
        <Box>
            <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mb: 1 }}>
                {items.map((item, i) => (
                    <Chip
                        key={`${i}:${textOf(item)}`}
                        size="small"
                        label={textOf(item)}
                        onDelete={() => onRemove(i)}
                        deleteIcon={<RemoveIcon label={`remove ${textOf(item)}`} />}
                    />
                ))}
            </Stack>
            <TextField
                id={id}
                size="small"
                fullWidth
                label={`add to ${label}`}
                value={draft}
                error={error !== ''}
                helperText={error || undefined}
                autoFocus={autoFocus}
                onChange={(event) => onDraft(event.target.value)}
            />
        </Box>
    );
}

const scalarText = (spec: EditorSpec, value: unknown) =>
    spec.kind === 'boolean' ? String(value === true) : textOf(value);

function parsedList(item: Scalar, list: unknown[]): Parsed {
    const values: unknown[] = [];
    for (const entry of list) {
        const result = parseScalar(item, textOf(entry));
        if ('error' in result) return { error: `${textOf(entry)}: ${result.error}` };
        values.push(result.value);
    }
    return { value: values };
}

/** An editor for one slot's value wrapper, generated from its schema: the value, its status, reason and source. */
export function SlotEditor({ label, schema, root = schema, value, mode, onSave, onCancel }: SlotEditorProps) {
    const id = useId();
    const spec = useMemo(() => wrapperSpec(root, schema), [root, schema]);
    const editor = spec.value ?? inferredEditor(value?.value);
    const [status, setStatus] = useState<string>(
        mode === 'not_reported' ? 'not_reported' : (value?.extraction_status ?? 'extracted')
    );
    const [reason, setReason] = useState(value?.unreported_reason ?? '');
    const [source, setSource] = useState<string>(value?.value_source ?? '');
    const [text, setText] = useState(() => (editor.kind === 'list' ? '' : scalarText(editor, value?.value)));
    const [list, setList] = useState<unknown[]>(() => (Array.isArray(value?.value) ? value.value : []));
    const [draft, setDraft] = useState('');
    const [error, setError] = useState('');
    const [draftError, setDraftError] = useState('');

    const save = () => {
        if (status === 'not_reported') {
            onSave({
                extraction_status: 'not_reported',
                ...(reason ? { unreported_reason: reason as SetValue['unreported_reason'] } : {}),
            });
            return;
        }
        const result = editor.kind === 'list' ? parsedList(editor.item, list) : parseScalar(editor, text);
        if ('error' in result) {
            setError(result.error);
            return;
        }
        onSave({
            extraction_status: 'extracted',
            value: result.value,
            ...(source ? { value_source: source as SetValue['value_source'] } : {}),
        });
    };

    const field = { id: `${id}-value`, label, error, autoFocus: mode === 'edit' && status === 'extracted' };
    const clearError =
        <T,>(set: (value: T) => void) =>
        (next: T) => {
            set(next);
            setError('');
        };

    /** Enter in the list's draft adds it to the list; with no draft, Enter falls through to save. */
    const onKey = (event: KeyboardEvent) => {
        if (editor.kind !== 'list' || event.key !== 'Enter' || draft.trim() === '') return false;
        if (!(event.target instanceof HTMLElement) || event.target.id !== field.id) return false;
        event.preventDefault();
        const parsed = parseScalar(editor.item, draft);
        if ('error' in parsed) {
            setDraftError(parsed.error);
            return true;
        }
        setList([...list, parsed.value]);
        setDraft('');
        setDraftError('');
        return true;
    };

    return (
        <Stack
            role="group"
            aria-label={`edit ${label}`}
            spacing={1.5}
            sx={{ py: 1 }}
            onKeyDown={panelKeys(save, onCancel, onKey)}
        >
            <Stack direction="row" spacing={1}>
                <NativeSelect
                    id={`${id}-status`}
                    label="In the paper?"
                    value={status}
                    options={spec.statuses}
                    labels={STATUS_WORDS}
                    onChange={clearError(setStatus)}
                />
                {status === 'not_reported' ? (
                    <NativeSelect
                        id={`${id}-reason`}
                        label="Why not"
                        value={reason}
                        options={['', ...spec.reasons]}
                        labels={reasonWords(spec.reasons)}
                        autoFocus={mode === 'not_reported'}
                        onChange={setReason}
                    />
                ) : (
                    spec.sources.length > 0 && (
                        <NativeSelect
                            id={`${id}-source`}
                            label="The value is"
                            value={source}
                            options={spec.sources}
                            labels={SOURCE_WORDS}
                            onChange={setSource}
                        />
                    )
                )}
            </Stack>
            {status !== 'not_reported' &&
                (editor.kind === 'list' ? (
                    <ListField
                        {...field}
                        items={list}
                        draft={draft}
                        error={draftError || error}
                        onDraft={(next) => {
                            setDraft(next);
                            setDraftError('');
                        }}
                        onRemove={(i) => setList(list.filter((_, j) => j !== i))}
                    />
                ) : (
                    <ScalarField {...field} spec={editor} value={text} onChange={clearError(setText)} />
                ))}
            <Stack direction="row" spacing={1}>
                <Button size="small" variant="contained" onClick={save}>
                    Save
                </Button>
                <Button size="small" onClick={onCancel}>
                    Cancel
                </Button>
            </Stack>
        </Stack>
    );
}
