import CancelIcon from '@mui/icons-material/Cancel';
import { Box, Button, IconButton, Stack, Typography } from '@mui/material';
import { useId } from 'react';
import { ScalarField } from '../inspector/SlotEditor';
import { axisKey, recordKey, type PointDraft } from './pointDraft';

/** The inputs of a point's fields: its vectors' axes side by side, its lists of records, then its scalars. */
export function PointFields({ draft, autoFocus }: { draft: PointDraft; autoFocus: boolean }) {
    const id = useId();
    const { texts, rows, errors } = draft;
    const fieldProps = (key: string, fieldLabel: string, focus = false) => ({
        id: `${id}-${key}`,
        label: fieldLabel,
        error: errors[key] ?? '',
        autoFocus: focus,
        value: texts[key] ?? '',
        onChange: draft.setText(key),
    });
    return draft.fields.map((field, order) => {
        if (field.kind === 'vector') {
            return (
                <Stack key={field.name} direction="row" spacing={1}>
                    {field.axes.map((axis, i) => (
                        <ScalarField
                            key={axis}
                            spec={field.item}
                            {...fieldProps(axisKey(field.name, i), axis, autoFocus && order === 0 && i === 0)}
                        />
                    ))}
                </Stack>
            );
        }
        if (field.kind === 'records') {
            return (
                <Box key={field.name}>
                    <Typography variant="caption" color="text.secondary" component="div">
                        {field.label}
                    </Typography>
                    <Stack role="list" aria-label={field.label} spacing={1} sx={{ my: 1 }}>
                        {rows[field.name].map((row, i) => (
                            <Stack key={row.id} role="listitem" direction="row" spacing={1} alignItems="flex-start">
                                {field.fields.map((f) => (
                                    <ScalarField
                                        key={f.name}
                                        spec={f.spec}
                                        id={`${id}-${recordKey(field.name, row.id, f.name)}`}
                                        label={`${f.label} ${i + 1}`}
                                        error={errors[recordKey(field.name, row.id, f.name)] ?? ''}
                                        autoFocus={false}
                                        value={row.texts[f.name]}
                                        onChange={draft.setRecordText(field.name, row.id, f.name)}
                                    />
                                ))}
                                <IconButton
                                    size="small"
                                    aria-label={`remove ${field.label} ${i + 1}`}
                                    onClick={() => draft.removeRecord(field.name, row.id)}
                                >
                                    <CancelIcon fontSize="small" />
                                </IconButton>
                            </Stack>
                        ))}
                    </Stack>
                    <Button size="small" onClick={() => draft.addRecord(field)}>
                        {`add ${field.label}`}
                    </Button>
                </Box>
            );
        }
        return (
            <ScalarField
                key={field.name}
                spec={field.spec}
                optional={!field.required}
                {...fieldProps(field.name, field.label)}
            />
        );
    });
}
