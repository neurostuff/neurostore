import { Box, Button, Stack, TextField } from '@mui/material';
import { memo, useState } from 'react';
import { StepCard } from './StepCard';

const COLLECTION_FIELDS: [string, string][] = [
    ['name', 'Collection name'],
    ['authors', 'Authors'],
    ['description', 'Description'],
    ['full_dataset_url', 'Dataset URL'],
];

/** Step 3. The text being typed is held here, not on the page, so typing re-renders
 * only this card; and the memo keeps the page's own re-renders from reaching it. */
export const CollectionDetails = memo(function CollectionDetails({
    collection,
    disabled,
    busy,
    onSave,
}: {
    collection: Record<string, string>;
    disabled: boolean;
    busy: boolean;
    onSave: (details: Record<string, string>) => void;
}) {
    const [details, setDetails] = useState(collection);
    return (
        <StepCard
            step={3}
            title="Collection details"
            subtitle="Title, author, etc filled in from your paper. Only modify this if it is incorrect."
            optional
        >
            <Stack spacing={1.5}>
                {COLLECTION_FIELDS.map(([field, label]) => (
                    <TextField
                        key={field}
                        size="small"
                        label={label}
                        value={details[field] ?? ''}
                        disabled={disabled}
                        multiline={field === 'description'}
                        onChange={(event) => setDetails({ ...details, [field]: event.target.value })}
                    />
                ))}
                <Box>
                    <Button
                        disabled={disabled || busy || JSON.stringify(details) === JSON.stringify(collection)}
                        onClick={() => onSave(details)}
                    >
                        Save details
                    </Button>
                </Box>
            </Stack>
        </StepCard>
    );
});
