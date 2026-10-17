import EditIcon from '@mui/icons-material/Edit';
import { Box, ButtonBase, Typography, type TypographyProps } from '@mui/material';
import { useId, useState } from 'react';
import { ScalarField } from '../inspector/SlotEditor';
import type { CoordinateAnalysis } from '../model/coordinates';
import { useIsEditable, useReviewStores, useSession, useView } from '../store/context';
import { renameAnalysis } from './actions';
import { coordinatePending } from './availability';
import { analysisEditors } from './schema';

const nameStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 0.5,
    textAlign: 'left',
    borderRadius: 0.5,
    '& .rv-pencil': { visibility: 'hidden', fontSize: '1em', color: 'text.secondary' },
    '&:hover .rv-pencil, &:focus-visible .rv-pencil': { visibility: 'visible' },
};

/** An analysis's name; a click opens it in the name's editor, Enter renames, Esc or leaving the field keeps it. */
export function AnalysisName({
    analysis,
    variant,
    component,
}: {
    analysis: CoordinateAnalysis;
    variant: TypographyProps['variant'];
    component: 'h2' | 'h3';
}) {
    const stores = useReviewStores();
    const editable = useIsEditable();
    const pending = useSession(coordinatePending);
    const focusAnalysis = useView((s) => s.focusAnalysis);
    const editors = analysisEditors();
    const id = useId();
    const [draft, setDraft] = useState<string | null>(null);
    const [error, setError] = useState('');
    if (draft !== null && editors.name) {
        const close = () => {
            setDraft(null);
            setError('');
        };
        return (
            <Box
                onClick={(event) => event.stopPropagation()}
                onBlur={close}
                onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                        event.preventDefault();
                        close();
                    } else if (event.key === 'Enter') {
                        event.preventDefault();
                        const name = draft.trim();
                        if (!name) setError('required');
                        else if (renameAnalysis(stores, analysis.key, name)) close();
                    }
                }}
            >
                <ScalarField
                    id={id}
                    label="analysis name"
                    spec={editors.name}
                    value={draft}
                    error={error}
                    autoFocus
                    onChange={(next) => {
                        setDraft(next);
                        setError('');
                    }}
                />
            </Box>
        );
    }
    return (
        <Typography variant={variant} component={component}>
            <ButtonBase
                sx={nameStyles}
                disabled={!editable || pending}
                aria-label={`rename ${analysis.name}`}
                title={analysis.key}
                onClick={(event) => {
                    event.stopPropagation();
                    focusAnalysis(analysis.key);
                    setDraft(analysis.name);
                }}
            >
                <Box component="span">{analysis.name}</Box>
                <EditIcon className="rv-pencil" aria-hidden />
            </ButtonBase>
        </Typography>
    );
}
