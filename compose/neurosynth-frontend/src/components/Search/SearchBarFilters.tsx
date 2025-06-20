import { Add } from '@mui/icons-material';
import { Box, Button, Chip, FormControl, InputLabel, MenuItem, Select, TextField } from '@mui/material';
import NeurosynthPopper from 'components/NeurosynthPopper/NeurosynthPopper';
import { SearchBy } from 'components/Search/search.types';
import { useEffect, useMemo, useRef, useState } from 'react';

const SearchBarFilters: React.FC<{
    searchMode: 'study-search' | 'project-search';
    nameSearch?: string | undefined;
    nameSearchAllowed?: boolean;
    journalSearch?: string | undefined;
    journalSearchAllowed?: boolean;
    descriptionSearch?: string | undefined;
    descriptionSearchAllowed?: boolean;
    authorSearch?: string | undefined;
    authorSearchAllowed?: boolean;
    onAddFilter: (newFilter: { filter: SearchBy; value: string }) => void;
    onRemoveFilter: (filter: { filter: SearchBy; value: string }) => void;
}> = (props) => {
    const {
        searchMode,
        nameSearch,
        nameSearchAllowed = true,
        journalSearch,
        journalSearchAllowed = true,
        descriptionSearch,
        descriptionSearchAllowed = true,
        authorSearch,
        authorSearchAllowed = true,
        onAddFilter,
        onRemoveFilter,
    } = props;

    const buttonElRef = useRef(null);
    const [addFilterPopupIsOpen, setAddFilterPopupIsOpen] = useState(false);
    // unfortunately we have to explicitly set the state of select
    // if we don't do this, the popper will close when you try and click select
    // setting disablePortal: false does not seem to be work so this is the solution:
    // https://stackoverflow.com/questions/69741515/closing-a-popper-mui-using-clickawaylistener-affects-everything-inside
    const [selectIsOpen, setSelectIsOpen] = useState(false);

    // used to display the filters
    const [existingFilters, setExistingFilters] = useState<{ filter: SearchBy; value: string }[]>([]);

    const filterOptions = useMemo(() => {
        let filterOptions;
        if (searchMode === 'study-search') {
            filterOptions = Object.keys(SearchBy).map(
                (filterOption) => SearchBy[filterOption as keyof typeof SearchBy]
            );
        } else {
            filterOptions = [SearchBy.TITLE, SearchBy.DESCRIPTION];
        }
        return filterOptions.filter(
            (filterOption) =>
                filterOption !== SearchBy.ALL &&
                existingFilters.every((existingFilter) => existingFilter.filter !== filterOption)
        );
    }, [existingFilters, searchMode]);

    // used when creating a new filter in the popup
    const [newFilter, setNewFilter] = useState<{
        filter: SearchBy | undefined;
        value: string;
    }>({
        filter: undefined,
        value: '',
    });

    useEffect(() => {
        setExistingFilters(() => {
            const filters = [];
            if (nameSearch && nameSearchAllowed) filters.push({ filter: SearchBy.TITLE, value: nameSearch });
            if (journalSearch && journalSearchAllowed) filters.push({ filter: SearchBy.JOURNAL, value: journalSearch });
            if (descriptionSearch && descriptionSearchAllowed)
                filters.push({ filter: SearchBy.DESCRIPTION, value: descriptionSearch });
            if (authorSearch && authorSearchAllowed) filters.push({ filter: SearchBy.AUTHORS, value: authorSearch });
            return filters;
        });
    }, [
        nameSearch,
        journalSearch,
        descriptionSearch,
        authorSearch,
        nameSearchAllowed,
        journalSearchAllowed,
        descriptionSearchAllowed,
        authorSearchAllowed,
    ]);

    const handleAddFilter = () => {
        if (newFilter.filter !== undefined && newFilter.value) {
            onAddFilter({
                filter: newFilter.filter,
                value: newFilter.value,
            });
            closePopper();
        }
    };

    const closePopper = () => {
        setAddFilterPopupIsOpen(false);
        setSelectIsOpen(false);
        setNewFilter({ filter: undefined, value: '' });
    };

    return (
        <>
            {existingFilters.map((filter) => (
                <Chip
                    key={filter.filter}
                    sx={{ marginLeft: '5px' }}
                    color="secondary"
                    label={`Filtering by ${filter.filter}: ${filter.value}`}
                    onDelete={() => onRemoveFilter(filter)}
                />
            ))}
            {filterOptions.length > 0 && (
                <>
                    <NeurosynthPopper
                        anchorElement={buttonElRef.current}
                        open={addFilterPopupIsOpen}
                        style={{ zIndex: 1 }}
                        onClickAway={() => {
                            if (selectIsOpen) return;
                            closePopper();
                        }}
                    >
                        <Box
                            sx={{ width: '250px', padding: '1rem' }}
                            component="form"
                            onSubmit={(event: React.FormEvent) => {
                                event.preventDefault();
                                handleAddFilter();
                            }}
                        >
                            <FormControl sx={{ marginBottom: '1rem' }} size="small" fullWidth>
                                <InputLabel>Field to filter By</InputLabel>
                                <Select
                                    label="Field to filter By"
                                    onChange={(event) => {
                                        setNewFilter((prev) => ({
                                            ...prev,
                                            filter: event.target.value as SearchBy,
                                        }));
                                        setSelectIsOpen(false);
                                    }}
                                    value={newFilter.filter || ''}
                                    open={selectIsOpen}
                                    onOpen={() => setSelectIsOpen(true)}
                                    onClose={() => setSelectIsOpen(false)}
                                >
                                    {filterOptions.map((filter) => (
                                        <MenuItem key={filter} value={filter}>
                                            {filter}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <FormControl fullWidth size="small">
                                <TextField
                                    onChange={(e) =>
                                        setNewFilter((prev) => ({
                                            ...prev,
                                            value: e.target.value || '',
                                        }))
                                    }
                                    label="Text to filter by"
                                    size="small"
                                />
                            </FormControl>
                            <Box sx={{ marginTop: '1rem' }}>
                                <Button type="submit" onClick={handleAddFilter} fullWidth>
                                    Add
                                </Button>
                            </Box>
                        </Box>
                    </NeurosynthPopper>
                    <Button
                        onClick={() => setAddFilterPopupIsOpen(true)}
                        ref={buttonElRef}
                        color="secondary"
                        sx={{ marginLeft: '5px' }}
                        startIcon={<Add />}
                    >
                        Add Filter
                    </Button>
                </>
            )}
        </>
    );
};

export default SearchBarFilters;
