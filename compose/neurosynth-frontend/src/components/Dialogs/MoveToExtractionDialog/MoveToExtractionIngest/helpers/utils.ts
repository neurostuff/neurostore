import { BaseStudy, StudyReturn } from 'neurostore-typescript-sdk';

export const selectBestVersionsForStudyset = (baseStudies: Array<BaseStudy>): string[] => {
    const selectedVersions = baseStudies.map((baseStudy) => {
        const sortedVersions = (
            baseStudy.versions as Array<
                Pick<
                    StudyReturn,
                    | 'id'
                    | 'created_at'
                    | 'updated_at'
                    | 'has_coordinates'
                    | 'has_images'
                    | 'source'
                    | 'studysets'
                    | 'user'
                >
            >
        ).sort((a, b) => {
            const dateAUpdatedAt = Date.parse(a.updated_at || '');
            const dateBUpdatedAt = Date.parse(b.updated_at || '');

            if (isNaN(dateAUpdatedAt) && dateBUpdatedAt) {
                // if update_at A does not exist, automatically treat A as smaller
                return -1;
            } else if (isNaN(dateBUpdatedAt) && dateAUpdatedAt) {
                // if update_at B does not exist, automatically treat B as smaller
                return 1;
            } else if (dateAUpdatedAt && dateBUpdatedAt && dateAUpdatedAt !== dateBUpdatedAt) {
                // if they both exist and are NOT the same, do comparison
                return dateAUpdatedAt - dateBUpdatedAt;
            } else {
                // if they do not exist, compare created_at instead
                const dateA = Date.parse(a.created_at || ''); // Date.parse('') will yield NaN
                const dateB = Date.parse(b.created_at || ''); // Date.parse('') will yield NaN
                if (isNaN(dateA) || isNaN(dateB)) return 0;
                return dateA - dateB;
            }
        });

        return sortedVersions[0].id as string;
    });

    return selectedVersions;
};
