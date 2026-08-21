import { lastUpdatedAtSortFn } from 'helpers/utils';
import { BaseStudyReturnInfo, BaseStudyReturnInfoVersion } from 'hooks/studies/studyQueries.types';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import { SearchDataType, SearchDataTypeEnumToString } from 'pages/Study/Study.types';

export const versionMatchesPreferredType = (
    version: BaseStudyReturnInfoVersion | undefined,
    preferredType: SearchDataType.COORDINATE | SearchDataType.IMAGE
): boolean => {
    if (!version) return false;
    if (preferredType === SearchDataType.IMAGE) return Boolean(version.has_images);
    return Boolean(version.has_coordinates);
};

export const getVersionTypeLabel = (
    version: Pick<BaseStudyReturnInfoVersion, 'has_images' | 'has_coordinates'>
): string => {
    if (version.has_images) return SearchDataTypeEnumToString[SearchDataType.IMAGE];
    if (version.has_coordinates) return SearchDataTypeEnumToString[SearchDataType.COORDINATE];
    return SearchDataTypeEnumToString[SearchDataType.COORDINATE];
};

export const selectBestBaseStudyVersion = (
    baseStudyVersions: BaseStudyReturnInfoVersion[],
    preferredType?: SearchDataType.COORDINATE | SearchDataType.IMAGE
) => {
    const typedVersions =
        preferredType !== undefined
            ? baseStudyVersions.filter((version) => versionMatchesPreferredType(version, preferredType))
            : [];
    const candidates = typedVersions.length > 0 ? typedVersions : baseStudyVersions;
    const sortedVersion = [...candidates].sort(lastUpdatedAtSortFn);
    return sortedVersion[sortedVersion.length - 1];
};

type StubLike = Pick<ICurationStubStudy, 'id'>;

export const mapStubsToStudysetPayload = (
    stubs: Array<StubLike>,
    stubBaseStudies: Array<BaseStudyReturnInfo>,
    existingStudyIds?: Set<string>,
    preferredType?: SearchDataType.COORDINATE | SearchDataType.IMAGE
): Array<{ id: string; curation_stub_uuid: string }> => {
    const payload: Array<{ id: string; curation_stub_uuid: string }> = [];

    stubs.forEach((stub, idx) => {
        const stubBaseStudy = stubBaseStudies[idx];
        if (!stubBaseStudy) return;

        const versions = stubBaseStudy.versions ?? [];

        // Prefer a version that already exists in the studyset.
        // Note: The backend will deduplicate versions, so we dont have to worry about the same version appearing multiple times in the studyset.
        const foundVersion = versions.find((studyVersion) => existingStudyIds?.has(studyVersion.id || ''));

        const chosenVersion = foundVersion || selectBestBaseStudyVersion(versions, preferredType);

        if (chosenVersion?.id) {
            payload.push({
                id: chosenVersion.id,
                curation_stub_uuid: stub.id,
            });
        }
    });

    return payload;
};
