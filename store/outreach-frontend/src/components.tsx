import { Chip, Link, Stack, Tooltip, Typography } from '@mui/material';
import { STATUS_LABELS } from './format';
import type { Stage } from './filters';
import { paperLinks } from './links';
import { OUTCOME_STATUSES, PREFERRED_SOFTWARE, type PersonSummary, type Software } from './types';

/** The paper's DOI, PubMed and PMC links; clicking one opens it without opening the row. */
export function PaperLinks(ids: { doi: string | null; pmid: string | null; pmcid: string | null }) {
    const links = paperLinks(ids);
    if (links.length === 0) return null;
    return (
        <Stack direction="row" spacing={1.5} component="span">
            {links.map((link) => (
                <Tooltip key={link.label} title={link.title} placement="top">
                    <Link
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        variant="caption"
                        onClick={(event) => event.stopPropagation()}
                    >
                        {link.label}
                    </Link>
                </Tooltip>
            ))}
        </Stack>
    );
}

export function PersonFlags({ person, drafted = true }: { person: PersonSummary | null; drafted?: boolean }) {
    if (!drafted) return null;
    if (!person) return <Chip size="small" color="warning" label="no address" />;
    return (
        <Stack direction="row" spacing={0.5}>
            {person.suppressed && <Chip size="small" color="error" label="opted out / bounced" />}
            {person.messages > 0 && <Chip size="small" label={`emailed ${person.messages}×`} />}
            {person.messages === 0 && person.author_messages > 0 && (
                <Chip size="small" label="emailed at another address" />
            )}
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

const SOURCE_LABELS = { ModelEstimation: 'model estimation', Preprocessing: 'preprocessing' } as const;

/** The packages a paper reports; preferred ones stand out. The texts read are in a tooltip,
 * since a paper's own wording is what to check. */
export function SoftwareChips({ software }: { software: Software | null }) {
    if (!software?.texts.length) return <Typography variant="caption" color="text.disabled">unknown</Typography>;
    const title = (
        <span>
            {software.source && `From the ${SOURCE_LABELS[software.source]}: `}
            {software.texts.join('; ')}
        </span>
    );
    return (
        <Tooltip title={title} placement="top">
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                {software.packages.length === 0 && <Chip size="small" variant="outlined" label="other" />}
                {software.packages.map((name) => {
                    const preferred = (PREFERRED_SOFTWARE as readonly string[]).includes(name);
                    return (
                        <Chip
                            key={name}
                            size="small"
                            color={preferred ? 'primary' : 'default'}
                            variant={preferred ? 'filled' : 'outlined'}
                            label={name}
                        />
                    );
                })}
            </Stack>
        </Tooltip>
    );
}
