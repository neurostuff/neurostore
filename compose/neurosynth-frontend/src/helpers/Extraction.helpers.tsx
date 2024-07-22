import { StudyReturn, BaseStudy } from 'neurostore-typescript-sdk';
import { lastUpdatedAtSortFn } from 'helpers/utils';

export const selectBestBaseStudyVersion = (baseStudyVersions: Array<StudyReturn>) => {
    const sortedVersion = [...baseStudyVersions.sort(lastUpdatedAtSortFn)];
    return sortedVersion[sortedVersion.length - 1];
};

export const selectBestVersionsForStudyset = (baseStudies: Array<BaseStudy>): string[] => {
    const selectedVersions = baseStudies.map((baseStudy) => {
        const studyVersion = selectBestBaseStudyVersion(
            (baseStudy?.versions || []) as StudyReturn[]
        );
        return studyVersion.id as string;
    });

    return selectedVersions;
};
