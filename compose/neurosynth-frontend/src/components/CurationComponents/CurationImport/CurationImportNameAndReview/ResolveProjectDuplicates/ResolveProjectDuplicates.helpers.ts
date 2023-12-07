import { ICurationColumn } from 'components/CurationComponents/CurationColumn/CurationColumn';
import { ENeurosynthTagIds } from 'pages/Projects/ProjectPage/ProjectStore.helpers';
import { IResolveProjectDuplicatesCurationStubStudy } from './ResolveProjectDuplicates.types';

export const flattenColumns = (
    cols: ICurationColumn[]
): IResolveProjectDuplicatesCurationStubStudy[] => {
    const allStubsInProject: IResolveProjectDuplicatesCurationStubStudy[] = (cols || []).reduce(
        (acc, curr, currIndex) => {
            const convertedStudies = curr.stubStudies.map((study, studyIndex) => {
                const resolutionStr: 'duplicate' | 'not-duplicate' | 'resolved' | undefined =
                    study.exclusionTag
                        ? study.exclusionTag.id === ENeurosynthTagIds.DUPLICATE_EXCLUSION_ID
                            ? 'duplicate'
                            : 'resolved'
                        : undefined;

                return {
                    ...study,
                    columnIndex: currIndex,
                    studyIndex: studyIndex,
                    colName: curr.name,
                    resolution: resolutionStr,
                };
            });

            acc.push(...convertedStudies);

            return acc;
        },
        [] as IResolveProjectDuplicatesCurationStubStudy[] // we need to typecast as typescript infers this type as never[]
    );

    return allStubsInProject;
};
