import { Autocomplete, Stack, TextField, Typography } from '@mui/material';
import { CHOSEN_FOLDER, TYPE_LABELS } from './review';
import type { GuessedKind } from './tree';

/** The dropdowns' options are set smaller than the text around them. */
const OPTIONS = { '& .MuiAutocomplete-option': { fontSize: '0.8rem', minHeight: 32 } };

/** A search box, folder and map type filters, and how many maps they leave. Used for the list
 * of maps to choose from and for the maps to swap in. */
export function MapFilters({
    total,
    shown,
    filtering,
    query,
    onQuery,
    folders,
    folderPick,
    onFolderPick,
    kinds,
    typePick,
    onTypePick,
    autoFocus = false,
}: {
    /** How many maps there are to search. */
    total: number;
    /** How many are left once the filters are applied. */
    shown: number;
    filtering: boolean;
    query: string;
    onQuery: (query: string) => void;
    /** Every folder on offer; empty names the folder the author chose. */
    folders: string[];
    folderPick: string[];
    onFolderPick: (folders: string[]) => void;
    kinds: GuessedKind[];
    typePick: GuessedKind[];
    onTypePick: (kinds: GuessedKind[]) => void;
    autoFocus?: boolean;
}) {
    return (
        <Stack spacing={0.75}>
            <TextField
                size="small"
                placeholder={`Filter by file or folder name across ${total} maps`}
                value={query}
                onChange={(event) => onQuery(event.target.value)}
                inputProps={{ 'aria-label': 'Filter maps' }}
                autoFocus={autoFocus}
                fullWidth
            />
            <Stack direction="row" spacing={1}>
                <Autocomplete
                    multiple
                    size="small"
                    disableCloseOnSelect
                    limitTags={1}
                    options={folders}
                    getOptionLabel={(option) => option || CHOSEN_FOLDER}
                    value={folderPick}
                    onChange={(_, value) => onFolderPick(value)}
                    ListboxProps={{ sx: OPTIONS }}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            placeholder={folderPick.length ? undefined : 'Folders'}
                            inputProps={{ ...params.inputProps, 'aria-label': 'Filter by folder' }}
                        />
                    )}
                    sx={{ flex: 1, minWidth: 0 }}
                />
                <Autocomplete
                    multiple
                    size="small"
                    disableCloseOnSelect
                    limitTags={1}
                    options={kinds}
                    getOptionLabel={(option) => TYPE_LABELS[option] ?? option}
                    value={typePick}
                    onChange={(_, value) => onTypePick(value)}
                    ListboxProps={{ sx: OPTIONS }}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            placeholder={typePick.length ? undefined : 'Map types'}
                            inputProps={{ ...params.inputProps, 'aria-label': 'Filter by map type' }}
                        />
                    )}
                    sx={{ flex: 1, minWidth: 0 }}
                />
            </Stack>
            <Typography variant="caption" color="text.secondary">
                {filtering ? `Showing ${shown} of ${total} maps` : `Showing ${total} maps`}
            </Typography>
        </Stack>
    );
}
