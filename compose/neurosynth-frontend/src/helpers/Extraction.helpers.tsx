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
    existingStudyIds?: Set<string>,
    stubToStudyId?: Map<string, string>,
    lockedStubToStudyId?: Map<string, string>
): Array<{ id: string; curation_stub_uuid: string }> => {
    const payload: Array<{ id: string; curation_stub_uuid: string }> = [];

    stubs.forEach((stub, idx) => {
        const lockedStudyId = lockedStubToStudyId?.get(stub.id);
        if (lockedStudyId) {
            payload.push({
                id: lockedStudyId,
                curation_stub_uuid: stub.id,
            });
            return;
        }

        const targetStudyId = stubToStudyId?.get(stub.id);

        // Prefer a base study that actually contains the mapped study version.
        const baseStudy =
            (targetStudyId &&
                baseStudies.find((bs) =>
                    (bs.versions || []).some((version) => version.id === targetStudyId)
                )) ||
            baseStudies[idx];

        if (!baseStudy) return;

        const versions = (baseStudy.versions || []) as Array<StudyReturn>;
        const existingForStub = targetStudyId;

        // Prefer a version that matches the study currently linked to this stub
        const foundVersion =
            versions.find((studyVersion) => studyVersion.id === existingForStub) ||
            versions.find((studyVersion) => existingStudyIds?.has(studyVersion.id || ''));

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
