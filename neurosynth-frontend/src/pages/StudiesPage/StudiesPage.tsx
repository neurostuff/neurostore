import { ChangeEvent, useEffect, useState } from 'react';
import { TablePagination, Typography, Pagination } from '@mui/material';
import DisplayTable from '../../components/DisplayStudiesTable/DisplayStudiesTable';
import SearchBar from '../../components/SearchBar/SearchBar';
import API, { StudyApiResponse } from '../../utils/api';
import { Metadata } from '../../gen/api';
import StudiesPageStyles from './StudiesPageStyles';

export enum Source {
    NEUROSTORE = 'neurostore',
    NEUROVAULT = 'neurovault',
    PUBMED = 'pubmed',
    NEUROSYNTH = 'neurosynth',
    NEUROQUERY = 'neuroquery',
}

enum SortBy {
    NAME = 'name',
    AUTHORS = 'authors',
    DESCRIPTION = 'description',
    CREATEDAT = 'created_at',
}

interface SearchCriteria {
    genericSearchStr: string | undefined; // search for entries across authors, name, description, etc
    sortBy: SortBy;
    pageOfResults: number; // goes from 1 onwards (0 and 1 yield identical results)
    descOrder: boolean;
    pageSize: number;
    isNested: boolean;
    nameSearch: string | undefined;
    descriptionSearch: string | undefined;
    authorSearch: string | undefined;
    showUnique: boolean;
    source: Source | undefined;
}

const StudiesPage = () => {
    const classes = StudiesPageStyles();
    const [studies, setStudies] = useState<StudyApiResponse[]>([]);
    const [searchMetadata, setSearchMetadata] = useState<Metadata>();
    const [searchCriteria, setSearchCriteria] = useState<SearchCriteria>({
        genericSearchStr: undefined,
        sortBy: SortBy.NAME,
        pageOfResults: 1,
        descOrder: true,
        pageSize: 10,
        isNested: false,
        nameSearch: undefined,
        descriptionSearch: undefined,
        authorSearch: undefined,
        showUnique: false,
        source: undefined,
    });

    const getNumTotalPages = (totalCount: number | undefined, pageSize: number | undefined) => {
        if (!totalCount || !pageSize) {
            return 0;
        }
        const dividedValue = Math.trunc(totalCount / pageSize);
        const remainder = totalCount % pageSize;
        return remainder > 0 ? dividedValue + 1 : dividedValue;
    };

    const handleOnSearch = (newSearchTerm: string) => {
        setSearchCriteria((prevState) => {
            return {
                ...prevState,
                genericSearchStr: newSearchTerm,
            };
        });
    };

    const handlePageChange = (
        event: React.MouseEvent<HTMLButtonElement, MouseEvent> | null,
        page: number
    ) => {
        setSearchCriteria((prevState) => {
            return {
                ...prevState,
                // we have to do this because MUI's pagination component starts at 0,
                // whereas 0 and 1 are the same in the backend
                pageOfResults: page + 1,
            };
        });
    };

    const handleRowsPerPageChange = (
        event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const newRowsPerPage = parseInt(event.target.value);

        setSearchCriteria((prevState) => {
            return {
                ...prevState,
                pageSize: newRowsPerPage,
            };
        });
    };

    const handlePaginationChange = (event: ChangeEvent<unknown>, page: number) => {
        if (page === null) return;

        setSearchCriteria((prevState) => {
            return {
                ...prevState,
                pageOfResults: page,
            };
        });
    };

    // runs for any change in study query
    useEffect(() => {
        const getStudies = (searchCriteria: SearchCriteria) => {
            API.Services.StudiesService.studiesGet(
                searchCriteria.genericSearchStr,
                searchCriteria.sortBy,
                searchCriteria.pageOfResults,
                searchCriteria.descOrder,
                searchCriteria.pageSize,
                searchCriteria.isNested,
                searchCriteria.nameSearch,
                searchCriteria.descriptionSearch,
                undefined,
                searchCriteria.showUnique,
                searchCriteria.source,
                searchCriteria.authorSearch
            )
                .then((res) => {
                    if (res?.data?.results) {
                        setSearchMetadata(res.data.metadata);
                        setStudies(res.data.results);
                    }
                })
                .catch((err) => {
                    console.log(err);
                });
        };

        getStudies(searchCriteria);
    }, [searchCriteria, searchCriteria.genericSearchStr]);

    return (
        <div>
            <Typography variant="h4">Studies Page</Typography>

            <SearchBar onSearch={handleOnSearch} />

            <TablePagination
                rowsPerPage={searchCriteria.pageSize}
                onRowsPerPageChange={handleRowsPerPageChange}
                onPageChange={handlePageChange}
                component="div"
                rowsPerPageOptions={[10, 25, 50, 99]}
                // we have to do this because MUI's pagination component starts at 0,
                // whereas 0 and 1 are the same in the backend
                page={searchCriteria.pageOfResults - 1}
                count={searchMetadata?.total_count || 0}
            ></TablePagination>

            <DisplayTable studies={studies} />

            <Pagination
                color="primary"
                className={classes.paginator}
                onChange={handlePaginationChange}
                showFirstButton
                showLastButton
                count={getNumTotalPages(searchMetadata?.total_count, searchCriteria.pageSize)}
            />
        </div>
    );
};
export default StudiesPage;
