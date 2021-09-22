import { ChangeEvent, useEffect, useState } from 'react';
import { TablePagination, Typography } from '@material-ui/core';
import DisplayTable from '../../components/DisplayStudiesTable/DisplayStudiesTable';
import SearchBar from '../../components/SearchBar/SearchBar';
import API, { StudyApiResponse } from '../../utils/api';
import { Metadata } from '../../gen/api';

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
        showUnique: true,
        source: undefined,
    });

    const handleOnSearch = (newSearchTerm: string) => {
        setSearchCriteria((prevState) => {
            return {
                ...prevState,
                genericSearchStr: newSearchTerm,
            };
        });
    };

    const p = () => {};

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
                style={{ marginBottom: '1%' }}
                rowsPerPage={searchCriteria.pageSize}
                onRowsPerPageChange={handleRowsPerPageChange}
                onPageChange={p}
                component="div"
                page={0}
                count={searchMetadata?.total_count || 0}
            ></TablePagination>

            <DisplayTable studies={studies} />
        </div>
    );
};
export default StudiesPage;
