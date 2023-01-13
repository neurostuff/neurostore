import { AxiosResponse } from 'axios';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudy';
import { useState } from 'react';
import { MutateOptions } from 'react-query';
import useGetProjectById from './useGetProjectById';
import { ITag } from './useGetProjects';
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
    });

    const { data } = useGetProjectById(projectId);
    const { mutate } = useUpdateProject();

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
                exclusionTag: undefined,
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

    const addTag = (
        columnIndex: number,
        stub: ICurationStubStudy,
        tag: ITag,
        options?: MutateOptions<AxiosResponse<any>, any, any, any>
    ) => {
        if (
            projectId &&
            stub.tags &&
            data?.provenance?.curationMetadata?.columns &&
            data?.provenance?.curationMetadata?.columns.length > 0
        ) {
            const tagExists = stub.tags.find((x) => x.id === tag.id);
            if (tagExists) return;
            setLoadingState((prev) => ({
                ...prev,
                updateTagsIsLoading: true,
            }));

            const updatedColumns = [...data.provenance.curationMetadata.columns];
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
        updatedValue: string | number,
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
