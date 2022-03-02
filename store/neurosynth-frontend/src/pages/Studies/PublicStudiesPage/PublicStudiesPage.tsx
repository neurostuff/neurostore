import { ChangeEvent, useEffect, useState } from 'react';
import { TablePagination, Typography, Pagination, Box } from '@mui/material';
import API, { StudyApiResponse } from '../../../utils/api';
import PublicStudiesPageStyles from './PublicStudiesPage.styles';
import { StudiesTable, SearchBar, NeurosynthLoader } from '../../../components';
import { Metadata } from '../../../gen/api';
import useIsMounted from '../../../hooks/useIsMounted';

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

export class SearchCriteria {
    constructor(
        public genericSearchStr: string | undefined = undefined,
        public sortBy: SortBy = SortBy.NAME,
        public pageOfResults: number = 1,
        public descOrder: boolean = true,
        public pageSize: number = 10,
        public isNested: boolean = false,
        public nameSearch: string | undefined = undefined,
        public descriptionSearch: string | undefined = undefined,
        public authorSearch: string | undefined = undefined,
        public showUnique: boolean = false,
        public source: Source | undefined = undefined
    ) {}
}

const PublicStudiesPage = () => {
    const [studies, setStudies] = useState<StudyApiResponse[]>();
    const [searchMetadata, setSearchMetadata] = useState<Metadata>();
    const [searchCriteria, setSearchCriteria] = useState<SearchCriteria>(new SearchCriteria());
    const isMountedRef = useIsMounted();

    const getNumTotalPages = (totalCount: number | undefined, pageSize: number | undefined) => {
        if (!totalCount || !pageSize) {
            return 0;
        }
        const numTotalPages = Math.trunc(totalCount / pageSize);
        const remainder = totalCount % pageSize;
        return remainder > 0 ? numTotalPages + 1 : numTotalPages;
    };

    const handleOnSearch = (newSearchTerm: SearchCriteria) => {
        setSearchCriteria((prevState) => {
            return {
                ...prevState,
                ...newSearchTerm, // same name properties override the ones in prevState
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
                // set page to 1 so that we don't have issue where the paginator goes out of bounds
                // when at the last page and rowsperpage is decreased
                pageOfResults: 1,
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
                    if (isMountedRef.current && res?.data?.results) {
                        setSearchMetadata(res.data.metadata);
                        setStudies(res.data.results);
                    }
                })
                .catch((err) => {
                    console.error(err);
                });
        };

        getStudies(searchCriteria);
    }, [searchCriteria, isMountedRef]);

    return (
        <>
            <Typography variant="h4">Public Studies</Typography>

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
                sx={PublicStudiesPageStyles.paginator}
            />

            <NeurosynthLoader loaded={!!studies}>
                <Box sx={{ marginBottom: '1rem' }}>
                    <StudiesTable showStudyOptions={true} studies={studies as StudyApiResponse[]} />
                </Box>
            </NeurosynthLoader>

            <Pagination
                color="primary"
                sx={PublicStudiesPageStyles.paginator}
                onChange={handlePaginationChange}
                showFirstButton
                showLastButton
                page={searchCriteria.pageOfResults}
                count={getNumTotalPages(searchMetadata?.total_count, searchCriteria.pageSize)}
            />
        </>
    );
};
export default PublicStudiesPage;
