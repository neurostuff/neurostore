import { Button, Checkbox, FormControlLabel, FormGroup, Radio, RadioGroup, Stack, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { acceptTarget, link, mergeCandidates, mergeCopies, mergeInto } from '../inspector/actions';
import { ConfirmDialog, PickPanel } from '../inspector/panels';
import type { EntityNode } from '../model/record';
import { useReviewStore, useReviewStoreApi } from '../store/context';
import { analysisSlotsFor } from './guided';

function LinkToAnalysis({ entity }: { entity: EntityNode }) {
    const store = useReviewStoreApi();
    const options = useMemo(() => {
        const { index } = store.getState();
        return analysisSlotsFor(index, entity);
    }, [store, entity]);
    return (
        <PickPanel
            options={options}
            label={`link ${entity.name} from`}
            noOptionsText="no analysis can link it"
            optionKey={(option) => option.id}
            onPick={(option) => link(store.getState(), option.slot, entity.id)}
        />
    );
}

/** The entities `entity` can merge into, the one chosen and the slots chosen to copy, following the record. */
function useMergeChoice(entity: EntityNode) {
    const store = useReviewStoreApi();
    const index = useReviewStore((s) => s.index);
    const [picked, setPicked] = useState('');
    const [copy, setCopy] = useState<string[]>([]);
    const candidates = useMemo(() => mergeCandidates({ index }, entity.id), [index, entity.id]);
    const into = candidates.some((candidate) => candidate.id === picked) ? picked : '';
    const copies = useMemo(() => (into ? mergeCopies({ index }, entity.id, into) : []), [index, entity.id, into]);
    return {
        candidates,
        copies,
        into,
        copy,
        pick: (id: string) => {
            setPicked(id);
            setCopy([]);
        },
        toggle: (path: string) =>
            setCopy((chosen) => (chosen.includes(path) ? chosen.filter((p) => p !== path) : [...chosen, path])),
        merge: () => into !== '' && mergeInto(store.getState(), entity.id, into, copy),
    };
}

function MergeDialog({ entity }: { entity: EntityNode }) {
    const { candidates, copies, into, copy, pick, toggle, merge } = useMergeChoice(entity);
    return (
        <ConfirmDialog title={`Merge ${entity.name} into…`} confirmLabel="Merge" onConfirm={merge}>
            {candidates.length === 0 ? (
                <Typography variant="body2">No other entity of this class.</Typography>
            ) : (
                <RadioGroup aria-label="merge into" value={into} onChange={(event) => pick(event.target.value)}>
                    {candidates.map((candidate) => (
                        <FormControlLabel
                            key={candidate.id}
                            value={candidate.id}
                            label={candidate.name}
                            control={<Radio size="small" />}
                        />
                    ))}
                </RadioGroup>
            )}
            {copies.length > 0 && (
                <FormGroup aria-label="copy over">
                    <Typography variant="body2">Copy over the slots it lacks:</Typography>
                    {copies.map((slot) => (
                        <FormControlLabel
                            key={slot.key}
                            label={slot.path}
                            control={
                                <Checkbox
                                    size="small"
                                    checked={copy.includes(slot.path)}
                                    onChange={() => toggle(slot.path)}
                                />
                            }
                        />
                    ))}
                </FormGroup>
            )}
            <Typography variant="caption" color="text.secondary">
                Every link to it moves to the one kept, then it is deleted; one undo reverses it all.
            </Typography>
        </ConfirmDialog>
    );
}

/** Step 4's actions on a leftover entity: keep, link from an analysis, merge into another, or delete. */
export function LeftoverActions({ entity }: { entity: EntityNode }) {
    const store = useReviewStoreApi();
    const panel = useReviewStore((s) => s.panel?.kind);
    const openPanel = useReviewStore((s) => s.openPanel);
    return (
        <Stack sx={{ px: 2, py: 1 }}>
            <Stack role="toolbar" aria-label="leftover actions" direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <Button
                    size="small"
                    variant="outlined"
                    onClick={() => acceptTarget(store.getState(), { kind: 'entity', entity: entity.id })}
                >
                    Keep
                </Button>
                <Button size="small" variant="outlined" onClick={() => openPanel('link_analysis')}>
                    Link to an analysis
                </Button>
                <Button size="small" variant="outlined" onClick={() => openPanel('merge_entity')}>
                    Merge into…
                </Button>
                <Button size="small" variant="outlined" color="error" onClick={() => openPanel('delete')}>
                    Delete
                </Button>
            </Stack>
            {panel === 'link_analysis' && <LinkToAnalysis entity={entity} />}
            {panel === 'merge_entity' && <MergeDialog entity={entity} />}
        </Stack>
    );
}
