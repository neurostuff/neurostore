import { StudyReturn, BaseStudy, BaseStudyReturn } from 'neurostore-typescript-sdk';
import { lastUpdatedAtSortFn } from 'helpers/utils';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';

export const selectBestBaseStudyVersion = (baseStudyVersions: Array<StudyReturn>) => {
    const sortedVersion = [...baseStudyVersions.sort(lastUpdatedAtSortFn)];
    return sortedVersion[sortedVersion.length - 1];
};

export const selectBestVersionsForStudyset = (baseStudies: Array<BaseStudy>): string[] => {
    const selectedVersions = baseStudies.map((baseStudy) => {
        const studyVersion = selectBestBaseStudyVersion((baseStudy?.versions || []) as StudyReturn[]);
        return studyVersion.id as string;
    });

    return selectedVersions;
};

type StubLike = Pick<ICurationStubStudy, 'id'>;

export const mapStubsToStudysetPayload = (
    stubs: Array<StubLike>,
    stubBaseStudies: Array<BaseStudyReturn>,
    existingStudyIds?: Set<string>
): Array<{ id: string; curation_stub_uuid: string }> => {
    const payload: Array<{ id: string; curation_stub_uuid: string }> = [];

    stubs.forEach((stub, idx) => {
        const stubBaseStudy = stubBaseStudies[idx];
        if (!stubBaseStudy) return;

        const versions = Array.isArray(stubBaseStudy.versions) ? (stubBaseStudy.versions as Array<StudyReturn>) : [];

        // Prefer a version that already exists in the studyset.
        // Note: The backend will deduplicate versions, so we dont have to worry about the same version appearing multiple times in the studyset.
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
