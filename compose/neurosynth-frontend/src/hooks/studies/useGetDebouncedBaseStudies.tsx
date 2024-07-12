import { AxiosResponse } from 'axios';
import { BaseStudyList } from 'neurostore-typescript-sdk';
import { SearchCriteria } from 'pages/Study/Study.types';
import { useQuery } from 'react-query';
import { baseStudiesSearchHelper } from './useGetBaseStudies';

let debounce: NodeJS.Timeout;
const useGetDebouncedBaseStudies = (searchCriteria: Partial<SearchCriteria>, enabled?: boolean) => {
    return useQuery(
        ['studies', { ...searchCriteria }],
        () => {
            if (debounce) clearTimeout(debounce);

            return new Promise<AxiosResponse<BaseStudyList>>((resolve, reject) => {
                debounce = setTimeout(async () => {
                    try {
                        const res = await baseStudiesSearchHelper(searchCriteria);
                        resolve(res);
                    } catch (e) {
                        reject(e);
                    }
                }, 500);
            });
        },
        {
            enabled,
            select: (res) => {
                const studyList = res.data;
                return studyList;
            },
        }
    );
};

export default useGetDebouncedBaseStudies;
