import { AxiosResponse } from 'axios';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudy';
import { useState } from 'react';
import { MutateOptions, useQueryClient } from 'react-query';
import useGetProjectById from './useGetProjectById';
import { INeurosynthProjectReturn, ISource, ITag } from './useGetProjects';
import useUpdateProject from './useUpdateProject';

const useUpdateCuration = (projectId: string | undefined) => {
    const [loadingState, setLoadingState] = useState({
        updateExclusionIsLoading: false,
        updateTagsIsLoading: false,
        updatetitleIsLoading: false,
        updateauthorsIsLoading: false,
        updatekeywordsIsLoading: false,
        updatepmidIsLoading: false,
        updatedoiIsLoading: false,
        updatearticleYearIsLoading: false,
        updatejournalIsLoading: false,
        updateabstractTextIsLoading: false,
        updateidentificationSourceIsLoading: false,
    });

    const { data } = useGetProjectById(projectId);
    const { mutate } = useUpdateProject();
    const queryClient = useQueryClient();

    const removeExclusion = (
        columnIndex: number,
        stubId: string,
        options?: MutateOptions<AxiosResponse<any>, any, any, any>
    ) => {
        if (
            projectId &&
            data?.provenance?.curationMetadata?.columns &&
            data.provenance.curationMetadata.columns.length > 0
        ) {
            const updatedColumns = [...data.provenance.curationMetadata.columns];
            const updatedStubsForColumn = [...updatedColumns[columnIndex].stubStudies];

            const thisStubIndex = updatedStubsForColumn.findIndex((x) => x.id === stubId);
            if (thisStubIndex < 0) return;

            setLoadingState((prev) => ({
                ...prev,
                updateExclusionIsLoading: true,
            }));

            updatedStubsForColumn[thisStubIndex] = {
                ...updatedStubsForColumn[thisStubIndex],
                exclusionTag: null,
            };
            updatedColumns[columnIndex] = {
                ...updatedColumns[columnIndex],
                stubStudies: updatedStubsForColumn,
            };

            mutate(
                {
                    projectId,
                    project: {
                        provenance: {
                            ...data.provenance,
                            curationMetadata: {
                                ...data.provenance.curationMetadata,
                                columns: updatedColumns,
                            },
                        },
                    },
                },
                {
                    onSettled: () => {
                        setLoadingState((prev) => ({
                            ...prev,
                            updateExclusionIsLoading: false,
                        }));
                    },
                    ...options,
                }
            );
        }
    };

    const addExclusion = (
        columnIndex: number,
        stubId: string,
        tag: ITag,
        options?: MutateOptions<AxiosResponse<any>, any, any, any>
    ) => {
        // addExclusion can be called immediately after a new exclusion has been created.
        // because of this, we need to grab the latest data in the cache directly so that the exclusions are up to date
        const newestData = queryClient.getQueryData(['projects', projectId]) as
            | AxiosResponse<INeurosynthProjectReturn>
            | undefined;

        if (
            projectId &&
            newestData?.data?.provenance?.curationMetadata?.columns &&
            newestData?.data.provenance.curationMetadata.columns.length > 0
        ) {
            const updatedColumns = [...newestData?.data.provenance.curationMetadata.columns];
            const updatedStubsForColumn = [...updatedColumns[columnIndex].stubStudies];

            const thisStubIndex = updatedStubsForColumn.findIndex((x) => x.id === stubId);
            if (thisStubIndex < 0) return;

            setLoadingState((prev) => ({
                ...prev,
                updateExclusionIsLoading: true,
            }));

            updatedStubsForColumn[thisStubIndex] = {
                ...updatedStubsForColumn[thisStubIndex],
                exclusionTag: tag,
            };
            updatedColumns[columnIndex] = {
                ...updatedColumns[columnIndex],
                stubStudies: updatedStubsForColumn,
            };

            mutate(
                {
                    projectId,
                    project: {
                        provenance: {
                            ...newestData.data.provenance,
                            curationMetadata: {
                                ...newestData.data.provenance.curationMetadata,
                                columns: updatedColumns,
                            },
                        },
                    },
                },
                {
                    onSettled: () => {
                        setLoadingState((prev) => ({
                            ...prev,
                            updateExclusionIsLoading: false,
                        }));
                    },
                    ...options,
                }
            );
        }
    };

    const addTag = (
        columnIndex: number,
        stub: ICurationStubStudy,
        tag: ITag,
        options?: MutateOptions<AxiosResponse<any>, any, any, any>
    ) => {
        // addTag can be called immediately after a new tag has been created.
        // because of this, we need to grab the latest data in the cache directly so that the infoTags are up to date
        const newestData = queryClient.getQueryData(['projects', projectId]) as
            | AxiosResponse<INeurosynthProjectReturn>
            | undefined;
        if (
            projectId &&
            stub.tags &&
            newestData?.data?.provenance?.curationMetadata?.columns &&
            newestData?.data?.provenance?.curationMetadata?.columns.length > 0
        ) {
            const tagExists = stub.tags.find((x) => x.id === tag.id);
            if (tagExists) return;
            setLoadingState((prev) => ({
                ...prev,
                updateTagsIsLoading: true,
            }));

            const updatedColumns = [...newestData.data.provenance.curationMetadata.columns];
            const updatedStubsForColumn = [...updatedColumns[columnIndex].stubStudies];

            const thisStubIndex = updatedStubsForColumn.findIndex((x) => x.id === stub.id);
            if (thisStubIndex < 0) return;

            updatedStubsForColumn[thisStubIndex] = {
                ...updatedStubsForColumn[thisStubIndex],
                tags: [...updatedStubsForColumn[thisStubIndex].tags, tag],
            };
            updatedColumns[columnIndex] = {
                ...updatedColumns[columnIndex],
                stubStudies: updatedStubsForColumn,
            };

            mutate(
                {
                    projectId,
                    project: {
                        provenance: {
                            ...newestData.data.provenance,
                            curationMetadata: {
                                ...newestData.data.provenance.curationMetadata,
                                columns: updatedColumns,
                            },
                        },
                    },
                },
                {
                    onSettled: (res) => {
                        setLoadingState((prev) => ({
                            ...prev,
                            updateTagsIsLoading: false,
                        }));
                    },
                    ...options,
                }
            );
        }
    };

    const removeTag = (
        columnIndex: number,
        stubId: string,
        tagId: string,
        options?: MutateOptions<AxiosResponse<any>, any, any, any>
    ) => {
        if (
            projectId &&
            data?.provenance?.curationMetadata?.columns &&
            data?.provenance?.curationMetadata?.columns?.length > 0
        ) {
            const updatedColumns = [...data.provenance.curationMetadata.columns];
            const updatedStubsForColumn = [...updatedColumns[columnIndex].stubStudies];

            const thisStubIndex = updatedStubsForColumn.findIndex((x) => x.id === stubId);
            if (thisStubIndex < 0) return;

            const updatedTags = [...updatedStubsForColumn[thisStubIndex].tags];
            const tagToRemoveIndex = updatedTags.findIndex((x) => x.id === tagId);
            if (tagToRemoveIndex < 0) return;

            setLoadingState((prev) => ({
                ...prev,
                updateTagsIsLoading: true,
            }));

            updatedTags.splice(tagToRemoveIndex, 1);

            updatedStubsForColumn[thisStubIndex] = {
                ...updatedStubsForColumn[thisStubIndex],
                tags: updatedTags,
            };

            updatedColumns[columnIndex] = {
                ...updatedColumns[columnIndex],
                stubStudies: updatedStubsForColumn,
            };

            mutate(
                {
                    projectId,
                    project: {
                        provenance: {
                            ...data.provenance,
                            curationMetadata: {
                                ...data.provenance.curationMetadata,
                                columns: updatedColumns,
                            },
                        },
                    },
                },
                {
                    onSettled: () => {
                        setLoadingState((prev) => ({
                            ...prev,
                            updateTagsIsLoading: false,
                        }));
                    },
                    ...options,
                }
            );
        }
    };

    const updateField = (
        columnIndex: number,
        stubId: string,
        field: keyof ICurationStubStudy,
        updatedValue: string | number | ISource,
        options?: MutateOptions<AxiosResponse<any>, any, any, any>
    ) => {
        if (
            projectId &&
            data?.provenance?.curationMetadata?.columns &&
            data?.provenance?.curationMetadata?.columns?.length > 0
        ) {
            const updatedColumns = [...data.provenance.curationMetadata.columns];
            const updatedStubsForColumn = [...updatedColumns[columnIndex].stubStudies];

            const stubIndex = updatedStubsForColumn.findIndex((x) => x.id === stubId);
            if (stubIndex < 0) return;

            const updatedField = `update${field}IsLoading`;

            setLoadingState((prev) => ({
                ...prev,
                [updatedField]: true,
            }));

            updatedStubsForColumn[stubIndex] = {
                ...updatedStubsForColumn[stubIndex],
                [field]: updatedValue,
            };

            updatedColumns[columnIndex] = {
                ...updatedColumns[columnIndex],
                stubStudies: updatedStubsForColumn,
            };

            mutate(
                {
                    projectId,
                    project: {
                        provenance: {
                            ...data.provenance,
                            curationMetadata: {
                                ...data.provenance.curationMetadata,
                                columns: updatedColumns,
                            },
                        },
                    },
                },
                {
                    onSettled: () => {
                        setLoadingState((prev) => ({
                            ...prev,
                            [updatedField]: false,
                        }));
                    },
                    ...options,
                }
            );
        }
    };

    return {
        removeExclusion,
        addExclusion,
        addTag,
        removeTag,
        updateField,
        ...loadingState,
    };
};

export default useUpdateCuration;
