import API from 'api/api.config';
import { EMapType, SearchCriteria, SearchDataType, SortBy } from 'pages/Study/Study.types';

export type BaseStudiesSearchShape = 'nested' | 'nonNested' | 'flat' | 'info';

/** Merge URL-driven search criteria with the flag combination for a given list payload shape. */
export const mergeBaseStudiesSearchShape = (
    searchCriteria: Partial<SearchCriteria>,
    shape: BaseStudiesSearchShape
): Partial<SearchCriteria> => {
    const base = { ...searchCriteria };
    switch (shape) {
        case 'nested':
            return { ...base, isNested: true, flat: false, info: false };
        case 'nonNested':
            return { ...base, isNested: false, flat: false, info: false };
        case 'flat':
            return { ...base, isNested: false, flat: true, info: false };
        case 'info':
            return { ...base, isNested: false, flat: false, info: true };
        default:
            return base;
    }
};

export const baseStudiesSearchHelper = (searchCriteria: Partial<SearchCriteria>) => {
    let mapType = undefined;
    if (searchCriteria.dataType === SearchDataType.IMAGE) {
        if (searchCriteria.IBMAMapType === EMapType.ANY) {
            mapType = undefined;
        } else {
            mapType = searchCriteria.IBMAMapType;
        }
    }

    return API.NeurostoreServices.BaseStudiesService.baseStudiesGet(
        searchCriteria.isNested,
        undefined, // year_min
        undefined, // x
        undefined, // y
        undefined, // z
        undefined, // radius
        undefined, // year_max
        undefined, // feature_filter
        undefined, // pipeline_config
        undefined, // feature_display
        undefined, // semantic_search
        undefined, // pipeline_config_id
        undefined, // distance_threshold
        undefined, // overall_cap
        undefined, // feature_flatten
        searchCriteria.genericSearchStr || undefined,
        searchCriteria.sortBy === SortBy.RELEVANCE ? undefined : searchCriteria.sortBy,
        searchCriteria.pageOfResults,
        searchCriteria.descOrder,
        searchCriteria.pageSize,
        searchCriteria.nameSearch || undefined,
        searchCriteria.descriptionSearch || undefined,
        searchCriteria.authorSearch || undefined,
        searchCriteria.level,
        searchCriteria.dataType === SearchDataType.ALL ? 'both' : searchCriteria.dataType,
        mapType,
        undefined, // is_oa
        searchCriteria.journalSearch || undefined,
        searchCriteria.pmid,
        searchCriteria.doi,
        undefined,
        searchCriteria.flat,
        searchCriteria.info
    );
};
