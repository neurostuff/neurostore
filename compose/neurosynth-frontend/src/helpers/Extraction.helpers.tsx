import { StudyReturn, BaseStudy, BaseStudyReturn } from 'neurostore-typescript-sdk';
import { lastUpdatedAtSortFn } from 'helpers/utils';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';

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

type StubLike = Pick<ICurationStubStudy, 'id'>;

export const mapStubsToStudysetPayload = (
    stubs: Array<StubLike>,
    baseStudies: Array<BaseStudyReturn>,
    existingStudyIds?: Set<string>
): Array<{ id: string; curation_stub_uuid: string }> => {
    const payload: Array<{ id: string; curation_stub_uuid: string }> = [];

    baseStudies.forEach((baseStudy, idx) => {
        const stub = stubs[idx];
        if (!stub) return;

        const versions = (baseStudy.versions || []) as Array<StudyReturn>;
        const foundVersion = versions.find((studyVersion) => existingStudyIds?.has(studyVersion.id || ''));
        const chosenVersion = foundVersion || selectBestBaseStudyVersion(versions);

        if (chosenVersion?.id) {
            payload.push({
                id: chosenVersion.id,
                curation_stub_uuid: stub.id,
            });
        }
    });

    return payload;
};
