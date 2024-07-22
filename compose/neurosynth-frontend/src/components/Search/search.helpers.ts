import { SearchCriteria } from 'pages/Study/Study.types';

export const getSearchCriteriaFromURL = (locationURL?: string): SearchCriteria => {
    const newSearchCriteria = new SearchCriteria();
    if (locationURL) {
        const search = new URLSearchParams(locationURL);

        let searchCriteriaObj: any = {}; // have to force this to be any so that we can assign props to the object
        for (const [key, value] of search) {
            if (key === 'pageOfResults' || key === 'pageSize') {
                const parsedValue = parseInt(value);
                if (!isNaN(parsedValue)) searchCriteriaObj[key] = parsedValue;
            } else if (key === 'descOrder' || key === 'showUnique') {
                const parsedValue = value === 'true';
                searchCriteriaObj[key] = parsedValue;
            } else if (key in newSearchCriteria) {
                searchCriteriaObj[key] = value;
            }
        }
        return {
            ...newSearchCriteria,
            ...searchCriteriaObj,
        };
    }
    return newSearchCriteria;
};

export const getURLFromSearchCriteria = (searchCriteria: Partial<SearchCriteria>) => {
    let stringifiedValueSearch: Record<string, string> = {};
    for (let [key, value] of Object.entries(searchCriteria)) {
        if (value === undefined) continue;
        stringifiedValueSearch[key] = `${value}`;
    }
    const search = new URLSearchParams(stringifiedValueSearch);
    return search.toString();
};

export const addKVPToSearch = (locationURL: string, key: string, value: string) => {
    const search = new URLSearchParams(locationURL);
    search.has(key) ? search.set(key, value) : search.append(key, value);
    return search.toString();
};
