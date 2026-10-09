import { describe, expect, it } from 'vitest';
import {
    addKVPToSearch,
    getNumTotalPages,
    getSearchCriteriaFromURL,
    getSearchResultRowNumber,
    getURLFromSearchCriteria,
} from 'components/Search/search.helpers';
import { SearchCriteria, SearchDataType, SortBy } from 'pages/Study/Study.types';

describe('search.helpers', () => {
    describe('getSearchCriteriaFromURL', () => {
        it('returns default search criteria when the URL is undefined', () => {
            expect(getSearchCriteriaFromURL(undefined)).toEqual(new SearchCriteria());
        });

        it('returns default search criteria when the URL is empty', () => {
            expect(getSearchCriteriaFromURL('')).toEqual(new SearchCriteria());
        });

        it('parses pageOfResults and pageSize as numbers', () => {
            expect(getSearchCriteriaFromURL('pageOfResults=3&pageSize=25')).toEqual({
                ...new SearchCriteria(),
                pageOfResults: 3,
                pageSize: 25,
            });
        });

        it('parses page params from location.search that starts with ?', () => {
            expect(getSearchCriteriaFromURL('?pageOfResults=2&pageSize=50')).toEqual({
                ...new SearchCriteria(),
                pageOfResults: 2,
                pageSize: 50,
            });
        });

        it('keeps default page values when page params are not numbers', () => {
            expect(getSearchCriteriaFromURL('pageOfResults=abc&pageSize=ten')).toEqual(new SearchCriteria());
        });

        it('parses descOrder and showUnique as booleans', () => {
            expect(getSearchCriteriaFromURL('descOrder=false&showUnique=true')).toEqual({
                ...new SearchCriteria(),
                descOrder: false,
                showUnique: true,
            });
        });

        it('treats descOrder and showUnique as false when the value is not true', () => {
            expect(getSearchCriteriaFromURL('descOrder=FALSE&showUnique=0')).toEqual({
                ...new SearchCriteria(),
                descOrder: false,
                showUnique: false,
            });
        });

        it('copies recognized string search fields from the URL', () => {
            expect(
                getSearchCriteriaFromURL(
                    'genericSearchStr=neuron&nameSearch=activation&authorSearch=Smith&journalSearch=Nature&dataType=coordinate&sortBy=name'
                )
            ).toEqual({
                ...new SearchCriteria(),
                genericSearchStr: 'neuron',
                nameSearch: 'activation',
                authorSearch: 'Smith',
                journalSearch: 'Nature',
                dataType: SearchDataType.COORDINATE,
                sortBy: SortBy.TITLE,
            });
        });

        it('ignores unrecognized query params', () => {
            expect(getSearchCriteriaFromURL('foo=bar&pageSize=25')).toEqual({
                ...new SearchCriteria(),
                pageSize: 25,
            });
        });
    });

    describe('getURLFromSearchCriteria', () => {
        it('stringifies defined search criteria fields', () => {
            const params = new URLSearchParams(
                getURLFromSearchCriteria({
                    genericSearchStr: 'neuron',
                    pageSize: 25,
                    pageOfResults: 2,
                    descOrder: false,
                })
            );

            expect(params.get('genericSearchStr')).toBe('neuron');
            expect(params.get('pageSize')).toBe('25');
            expect(params.get('pageOfResults')).toBe('2');
            expect(params.get('descOrder')).toBe('false');
        });

        it('omits undefined fields', () => {
            const params = new URLSearchParams(
                getURLFromSearchCriteria({
                    genericSearchStr: 'neuron',
                    authorSearch: undefined,
                })
            );

            expect(params.get('genericSearchStr')).toBe('neuron');
            expect(params.has('authorSearch')).toBe(false);
        });

        it('returns an empty string when every field is undefined', () => {
            expect(getURLFromSearchCriteria({ genericSearchStr: undefined, authorSearch: undefined })).toBe('');
        });
    });

    describe('addKVPToSearch', () => {
        it('appends a new key when it is not already present', () => {
            const params = new URLSearchParams(addKVPToSearch('pageSize=10', 'pageOfResults', '2'));
            expect(params.get('pageSize')).toBe('10');
            expect(params.get('pageOfResults')).toBe('2');
        });

        it('replaces an existing key', () => {
            const params = new URLSearchParams(addKVPToSearch('pageSize=10&pageOfResults=1', 'pageSize', '25'));
            expect(params.get('pageSize')).toBe('25');
            expect(params.get('pageOfResults')).toBe('1');
            expect(params.getAll('pageSize')).toEqual(['25']);
        });

        it('adds a key to an empty search string', () => {
            expect(addKVPToSearch('', 'pageSize', '10')).toBe('pageSize=10');
        });

        it('handles location.search that starts with ?', () => {
            const params = new URLSearchParams(addKVPToSearch('?pageSize=10', 'pageOfResults', '3'));
            expect(params.get('pageSize')).toBe('10');
            expect(params.get('pageOfResults')).toBe('3');
        });
    });

    describe('getNumTotalPages', () => {
        it('returns 0 when totalCount is missing or 0', () => {
            expect(getNumTotalPages(undefined, 10)).toBe(0);
            expect(getNumTotalPages(0, 10)).toBe(0);
        });

        it('returns 0 when pageSize is missing or 0', () => {
            expect(getNumTotalPages(100, undefined)).toBe(0);
            expect(getNumTotalPages(100, 0)).toBe(0);
        });

        it('returns the exact quotient when totalCount divides evenly', () => {
            expect(getNumTotalPages(100, 10)).toBe(10);
            expect(getNumTotalPages(10, 10)).toBe(1);
        });

        it('rounds up when there is a remainder', () => {
            expect(getNumTotalPages(101, 10)).toBe(11);
            expect(getNumTotalPages(9, 10)).toBe(1);
        });
    });

    describe('getSearchResultRowNumber', () => {
        it('numbers the first row on the first page as 1', () => {
            expect(getSearchResultRowNumber(1, 10, 0)).toBe(1);
        });

        it('numbers later rows on the first page from 1', () => {
            expect(getSearchResultRowNumber(1, 10, 9)).toBe(10);
        });

        it('adds skipped rows from previous pages using pageOfResults and pageSize', () => {
            expect(getSearchResultRowNumber(2, 10, 0)).toBe(11);
            expect(getSearchResultRowNumber(2, 10, 4)).toBe(15);
            expect(getSearchResultRowNumber(3, 10, 0)).toBe(21);
            expect(getSearchResultRowNumber(3, 10, 9)).toBe(30);
        });

        it('aligns with a larger page size', () => {
            expect(getSearchResultRowNumber(1, 25, 0)).toBe(1);
            expect(getSearchResultRowNumber(2, 25, 0)).toBe(26);
            expect(getSearchResultRowNumber(2, 25, 4)).toBe(30);
            expect(getSearchResultRowNumber(3, 25, 0)).toBe(51);
            expect(getSearchResultRowNumber(3, 25, 24)).toBe(75);
        });

        it('treats a missing or zero page as page 1', () => {
            expect(getSearchResultRowNumber(0, 10, 0)).toBe(1);
        });
    });
});
