import { Chip, Stack } from '@mui/material';
import { STATUS_LABELS } from './format';
import type { Stage } from './filters';
import { OUTCOME_STATUSES, type PersonSummary } from './types';

export function PersonFlags({ person, drafted = true }: { person: PersonSummary | null; drafted?: boolean }) {
    if (!drafted) return null;
    if (!person) return <Chip size="small" color="warning" label="no address" />;
    return (
        <Stack direction="row" spacing={0.5}>
            {person.suppressed && <Chip size="small" color="error" label="opted out / bounced" />}
            {person.messages > 0 && <Chip size="small" label={`emailed ${person.messages}×`} />}
        </Stack>
    );
}

export function StatusChip({ status }: { status: Stage }) {
    const color = OUTCOME_STATUSES.includes(status as (typeof OUTCOME_STATUSES)[number])
        ? 'error'
        : status === 'published'
          ? 'success'
          : 'default';
    return (
        <Chip
            size="small"
            color={color}
            variant={status === 'not_started' ? 'outlined' : 'filled'}
            label={STATUS_LABELS[status] ?? status}
        />
    );
}
