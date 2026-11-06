import { Button, Stack, Typography } from '@mui/material';
import type { ParsedPaperLayout } from '../model/layout';
import { useIsEditable, useSession, useView } from '../store/context';
import { addAnalysisPanel, textAnalysisPanel } from './actions';
import { Hint } from '../review/Hint';

const NO_TABLES: NonNullable<ParsedPaperLayout['tables']> = [];

/** Where a new analysis can come from: the selected text, or any table of the paper. */
export function AddAnalysisChooser() {
    const editable = useIsEditable();
    const selection = useView((s) => s.selection);
    const openPanel = useView((s) => s.openPanel);
    const tables = useSession((s) => (s.bundle.parsed_paper as ParsedPaperLayout).tables ?? NO_TABLES);
    return (
        <Stack
            role="group"
            aria-label="add an analysis"
            direction="row"
            spacing={1}
            useFlexGap
            flexWrap="wrap"
            alignItems="center"
            sx={{ px: 2, py: 1, borderTop: 1, borderColor: 'divider' }}
            onMouseDown={(event) => event.preventDefault()}
        >
            <Typography variant="overline" component="h3">
                Add an analysis
            </Typography>
            <Hint title="A new analysis from the sentence selected in the paper, with the x, y and z printed there; or a null result with no points">
                <span>
                    <Button
                        size="small"
                        variant="outlined"
                        disabled={!editable || !selection}
                        onClick={() => selection && openPanel(textAnalysisPanel(selection))}
                    >
                        From the selected text
                    </Button>
                </span>
            </Hint>
            {!selection && (
                <Typography variant="caption" color="text.secondary">
                    select its sentence in the paper first
                </Typography>
            )}
            {tables.map((table) => (
                <Hint
                    key={table.table_id}
                    title={`A new analysis of the coordinates in ${table.label ?? table.table_id}`}
                >
                    <span>
                        <Button
                            size="small"
                            disabled={!editable}
                            onClick={() => openPanel(addAnalysisPanel(table.table_id))}
                        >
                            {`To ${table.label ?? table.table_id}`}
                        </Button>
                    </span>
                </Hint>
            ))}
        </Stack>
    );
}
