import { lastUpdatedAtSortFn } from 'helpers/utils';
import { BaseStudyReturnInfo } from 'hooks/studies/studyQueries.types';
import { StudyReturn } from 'neurostore-typescript-sdk';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';

export const selectBestBaseStudyVersion = (baseStudyVersions: Array<StudyReturn>) => {
    const sortedVersion = [...baseStudyVersions.sort(lastUpdatedAtSortFn)];
    return sortedVersion[sortedVersion.length - 1];
};

type StubLike = Pick<ICurationStubStudy, 'id'>;

export const mapStubsToStudysetPayload = (
    stubs: Array<StubLike>,
    stubBaseStudies: Array<BaseStudyReturnInfo>,
    existingStudyIds?: Set<string>
): Array<{ id: string; curation_stub_uuid: string }> => {
    const payload: Array<{ id: string; curation_stub_uuid: string }> = [];

    stubs.forEach((stub, idx) => {
        const stubBaseStudy = stubBaseStudies[idx];
        if (!stubBaseStudy) return;

        const versions = stubBaseStudy.versions ?? [];

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
