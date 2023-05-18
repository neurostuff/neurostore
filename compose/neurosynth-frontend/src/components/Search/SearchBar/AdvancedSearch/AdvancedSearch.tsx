import {
    Box,
    Button,
    Checkbox,
    FormControlLabel,
    FormGroup,
    IconButton,
    MenuItem,
    Select,
    TextField,
    Typography,
} from '@mui/material';
import {
    SearchBy,
    SearchByMapping,
    SearchCriteria,
    SearchDataType,
    SortBy,
    Source,
} from 'pages/Studies/StudiesPage/StudiesPage';
import React, { useEffect, useState } from 'react';
import { ISearchBar } from '../SearchBar';
import DeleteIcon from '@mui/icons-material/Delete';
import NeurosynthPopupMenu from 'components/NeurosynthPopupMenu/NeurosynthPopupMenu';
import { useAuth0 } from '@auth0/auth0-react';
import { useLocation } from 'react-router-dom';
import { getSearchCriteriaFromURL } from 'pages/helpers/utils';

interface ISearchState {
    fields: {
        fieldName: SearchBy;
        value: string;
    }[];
    dataType: SearchDataType;
    source: Source;
    sortBy: SortBy;
    unique: boolean;
    onlyUserStudies: boolean;
    desc: 'ascending' | 'descending';
}

const AdvancedSearch: React.FC<ISearchBar> = (props) => {
    const { user } = useAuth0();
    const location = useLocation();

    useEffect(() => {
        const searchCriteria = getSearchCriteriaFromURL(location.search);

        const fields = [];
        if (searchCriteria.genericSearchStr)
            fields.push({ fieldName: SearchBy.ALL, value: searchCriteria.genericSearchStr });
        if (searchCriteria.nameSearch)
            fields.push({ fieldName: SearchBy.TITLE, value: searchCriteria.nameSearch });
        if (searchCriteria.authorSearch)
            fields.push({ fieldName: SearchBy.AUTHORS, value: searchCriteria.authorSearch });
        if (searchCriteria.descriptionSearch)
            fields.push({
                fieldName: SearchBy.DESCRIPTION,
                value: searchCriteria.descriptionSearch,
            });

        if (fields.length === 0) fields.push({ fieldName: SearchBy.ALL, value: '' });

        setSearchState({
            fields,
            dataType: searchCriteria.dataType || SearchDataType.COORDINATE,
            source: searchCriteria.source || Source.ALL,
            sortBy: searchCriteria.sortBy || SortBy.TITLE,
            unique: searchCriteria.showUnique === undefined ? true : searchCriteria.showUnique,
            onlyUserStudies: !!searchCriteria.userId,
            desc: searchCriteria.descOrder ? 'descending' : 'ascending',
        });
    }, [location.search]);

    const [searchState, setSearchState] = useState<ISearchState>({
        fields: [{ fieldName: SearchBy.ALL, value: '' }],
        dataType: SearchDataType.COORDINATE,
        source: Source.ALL,
        sortBy: SortBy.TITLE,
        unique: true,
        onlyUserStudies: false,
        desc: 'descending',
    });

    const handleAddSearchField = (value: string | number) => {
        setSearchState((prev) => {
            if (prev.fields.findIndex((x) => x.fieldName === value) >= 0) return prev;

            const update = [...prev.fields];
            update.push({
                fieldName: value as SearchBy,
                value: '',
            });
            return {
                ...prev,
                fields: update,
            };
        });
    };

    const handleUpdateSearchField = (index: number, value: string) => {
        setSearchState((prev) => {
            const update = [...prev.fields];
            update[index].value = value;
            return {
                ...prev,
                fields: update,
            };
        });
    };

    const handleRemoveField = (index: number) => {
        setSearchState((prev) => {
            const update = [...prev.fields];
            update.splice(index, 1);
            return {
                ...prev,
                fields: update,
            };
        });
    };

    const handleUpdateSearchState = (field: keyof ISearchState, value: any) => {
        setSearchState((prev) => {
            return {
                ...prev,
                [field]: value,
            };
        });
    };

    const handleSearch = (event: React.MouseEvent) => {
        const searchByObj = searchState.fields.reduce((acc, curr) => {
            const searchCriteriaKey = SearchByMapping[curr.fieldName] as keyof SearchCriteria;
            acc[searchCriteriaKey] = curr.value;
            return acc;
        }, {} as any);

        props.onSearch({
            dataType: searchState.dataType,
            source: searchState.source,
            sortBy: searchState.sortBy,
            showUnique: searchState.unique,
            descOrder: searchState.desc === 'descending',
            userId: searchState.onlyUserStudies ? user?.sub : undefined,
            ...searchByObj,
        });
    };

    return (
        <Box sx={{ padding: '1rem', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Box>
                    <FormGroup>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={searchState.unique}
                                    onChange={(event) =>
                                        handleUpdateSearchState('unique', event.target.checked)
                                    }
                                />
                            }
                            label="Only show unique results"
                        />
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={searchState.onlyUserStudies}
                                    onChange={(event) =>
                                        handleUpdateSearchState(
                                            'onlyUserStudies',
                                            event.target.checked
                                        )
                                    }
                                />
                            }
                            label="Only show my studies"
                        />
                    </FormGroup>
                </Box>

                <Typography>Search</Typography>
                <Box>
                    {searchState.fields.map((field, index) => {
                        return (
                            <Box key={index} sx={{ marginBottom: '10px' }}>
                                <TextField
                                    sx={{
                                        width: '200px',
                                        input: {
                                            WebkitTextFillColor: 'rgb(0,0,0,1) !important',
                                            color: 'black',
                                        },
                                    }}
                                    disabled
                                    value={field.fieldName}
                                />
                                <TextField
                                    onChange={(event) =>
                                        handleUpdateSearchField(index, event.target.value)
                                    }
                                    value={field.value}
                                    sx={{
                                        width: '300px',
                                        marginLeft: '0.5rem',
                                        backgroundColor: 'white',
                                    }}
                                    variant="outlined"
                                />
                                <IconButton
                                    size="large"
                                    onClick={() => handleRemoveField(index)}
                                    sx={{ marginLeft: '10px' }}
                                    color="error"
                                >
                                    <DeleteIcon />
                                </IconButton>
                            </Box>
                        );
                    })}
                    <Box sx={{ margin: '5px 0' }}>
                        <NeurosynthPopupMenu
                            buttonProps={{}}
                            buttonLabel="Add Search Field"
                            options={[
                                {
                                    label: 'All fields',
                                    value: SearchBy.ALL,
                                    onClick: handleAddSearchField,
                                },
                                {
                                    label: 'Title',
                                    value: SearchBy.TITLE,
                                    onClick: handleAddSearchField,
                                },
                                {
                                    label: 'Authors',
                                    value: SearchBy.AUTHORS,
                                    onClick: handleAddSearchField,
                                },
                                {
                                    label: 'Description',
                                    value: SearchBy.DESCRIPTION,
                                    onClick: handleAddSearchField,
                                },
                            ]}
                        />
                    </Box>
                </Box>
                <Typography>Studies Data Type</Typography>
                <Box>
                    <Select
                        onChange={(event) =>
                            handleUpdateSearchState('dataType', event.target.value)
                        }
                        value={searchState.dataType}
                        sx={{ width: '200px', backgroundColor: 'white' }}
                        size="small"
                    >
                        <MenuItem value={SearchDataType.BOTH}>All</MenuItem>
                        <MenuItem value={SearchDataType.COORDINATE}>Coordinates</MenuItem>
                        <MenuItem value={SearchDataType.IMAGE}>Images</MenuItem>
                    </Select>
                </Box>
                <Typography>Studies Source</Typography>
                <Box>
                    <Select
                        onChange={(event) => handleUpdateSearchState('source', event.target.value)}
                        value={searchState.source}
                        sx={{ width: '200px', backgroundColor: 'white' }}
                        size="small"
                    >
                        <MenuItem value={Source.ALL}>All Sources</MenuItem>
                        <MenuItem value={Source.NEUROSTORE}>Neurostore</MenuItem>
                        <MenuItem value={Source.NEUROVAULT}>Neurovault</MenuItem>
                        <MenuItem value={Source.PUBMED}>PubMed</MenuItem>
                        <MenuItem value={Source.NEUROSYNTH}>Neurosynth</MenuItem>
                        <MenuItem value={Source.NEUROQUERY}>Neuroquery</MenuItem>
                    </Select>
                </Box>
                <Typography>Sort By</Typography>
                <Box>
                    <Select
                        onChange={(event) => handleUpdateSearchState('sortBy', event.target.value)}
                        value={searchState.sortBy}
                        sx={{ width: '200px', backgroundColor: 'white' }}
                        size="small"
                    >
                        <MenuItem value={SortBy.TITLE}>Title</MenuItem>
                        <MenuItem value={SortBy.SOURCE}>Source</MenuItem>
                        <MenuItem value={SortBy.DESCRIPTION}>Description</MenuItem>
                        <MenuItem value={SortBy.CREATEDAT}>Date Created</MenuItem>
                        <MenuItem value={SortBy.PUBLICATION}>Journal</MenuItem>
                        <MenuItem value={SortBy.AUTHORS}>Authors</MenuItem>
                    </Select>
                    <Select
                        value={searchState.desc}
                        onChange={(event) => handleUpdateSearchState('desc', event.target.value)}
                        sx={{ width: '140px', marginLeft: '10px', backgroundColor: 'white' }}
                        size="small"
                    >
                        <MenuItem value="ascending">Ascending</MenuItem>
                        <MenuItem value="descending">Descending</MenuItem>
                    </Select>
                </Box>
            </Box>
            <Box>
                <Button
                    onClick={handleSearch}
                    size="large"
                    sx={{ marginTop: '1rem', backgroundColor: props.searchButtonColor }}
                    variant="contained"
                >
                    Search
                </Button>
            </Box>
        </Box>
    );
};

export default AdvancedSearch;
