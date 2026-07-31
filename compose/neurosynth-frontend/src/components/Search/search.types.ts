import { SystemStyleObject } from '@mui/system';
import { ProjectSearchCriteria } from 'hooks/projects/useGetProjects';
import { SearchCriteria } from 'pages/Study/Study.types';

export enum SearchBy {
    ALL = 'all fields',
    TITLE = 'title',
    DESCRIPTION = 'description',
    AUTHORS = 'authors',
    JOURNAL = 'journal',
}

export const SearchByMapping = {
    [SearchBy.ALL]: 'genericSearchStr',
    [SearchBy.AUTHORS]: 'authorSearch',
    [SearchBy.DESCRIPTION]: 'descriptionSearch',
    [SearchBy.TITLE]: 'nameSearch',
    [SearchBy.JOURNAL]: 'journalSearch',
};

export interface IStudiesSearchContainer {
    onPageChange: (newPage: number) => void;
    onRowsPerPageChange: (newRowsPerPage: number) => void;
    onSearch: (searchArgs: Partial<SearchCriteria>) => void;
    totalCount: number | undefined;
    pageSize: number;
    pageOfResults: number;
    searchButtonColor?: string;
    paginationSelectorStyles?: SystemStyleObject;
    tablePaginationSelectorStyles?: SystemStyleObject;
    error?: string;
    children?: React.ReactNode;
}

export interface IProjectsSearchContainer {
    onPageChange: (newPage: number) => void;
    onRowsPerPageChange: (newRowsPerPage: number) => void;
    onSearch: (searchArgs: Partial<ProjectSearchCriteria>) => void;
    totalCount: number | undefined;
    pageSize: number;
    pageOfResults: number;
    searchButtonColor?: string;
    paginationSelectorStyles?: SystemStyleObject;
    tablePaginationSelectorStyles?: SystemStyleObject;
    children?: React.ReactNode;
}
