import { useAuth0 } from '@auth0/auth0-react';
import { Draggable, Droppable } from '@hello-pangea/dnd';
import { Autocomplete, Box, Button, Divider, ListItem, ListItemText, Paper, TextField } from '@mui/material';

import CurationPromoteUncategorizedButton from 'components/Buttons/CurationPromoteUncategorizedButton';
import VirtualizedList from 'components/VirtualizedList/VirtualizedList';
import { ITag, indexToPRISMAMapping } from 'hooks/projects/useGetProjects';
import useGetWindowHeight from 'hooks/useGetWindowHeight';
import useUserCanEdit from 'hooks/useUserCanEdit';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import CurationColumnStyles from 'pages/Curation/components/CurationColumn.styles';
import CurationDialog from 'pages/Curation/components/CurationDialog';
import CurationStubStudyDraggableContainer from 'pages/Curation/components/CurationStubStudyDraggableContainer';
import {
    useProjectCurationColumn,
    useProjectCurationExclusionTags,
    useProjectCurationInfoTags,
    useProjectCurationPrismaConfig,
    useProjectUser,
} from 'pages/Project/store/ProjectStore';
import { ENeurosynthTagIds } from 'pages/Project/store/ProjectStore.consts';
import React, { useEffect, useMemo, useState } from 'react';

const ROW_HEIGHT_PX = 140;

const getVisibility = (stub: ICurationStubStudy, selectedTag: ITag | undefined): boolean => {
    let isVisible = false;
    if (!selectedTag) {
        isVisible = true;
    } else if (selectedTag.isExclusionTag) {
        isVisible = selectedTag.id === stub.exclusionTag;
    } else if (selectedTag.id === ENeurosynthTagIds.UNTAGGED_TAG_ID) {
        isVisible = stub.tags.length === 0 && stub?.exclusionTag === null;
    } else if (selectedTag.id === ENeurosynthTagIds.UNCATEGORIZED_ID) {
        isVisible = stub?.exclusionTag === null;
    } else {
        isVisible = stub.tags.some((tag) => tag.id === selectedTag.id);
    }
    return isVisible;
};

const VirtualizedColumnRow = React.memo(
    ({
        stub,
        index,
        style,
        columnIndex,
        onSelectStub,
        selectedTag,
    }: {
        stub: ICurationStubStudy;
        index: number;
        style: React.CSSProperties;
        columnIndex: number;
        onSelectStub: (stubId: string) => void;
        selectedTag: ITag | undefined;
    }) => {
        const projectUser = useProjectUser();
        const canEdit = useUserCanEdit(projectUser || undefined);

        return (
            <Draggable
                draggableId={stub.id}
                index={index}
                isDragDisabled={!!stub?.exclusionTag || !canEdit}
                key={stub.id}
            >
                {(provided, snapshot) => (
                    <CurationStubStudyDraggableContainer
                        {...stub}
                        provided={provided}
                        snapshot={snapshot}
                        index={index}
                        style={style}
                        isVisible={getVisibility(stub, selectedTag)}
                        onSelectStubStudy={onSelectStub}
                        columnIndex={columnIndex}
                    />
                )}
            </Draggable>
        );
    }
);

const CurationColumn = React.memo((props: { columnIndex: number }) => {
    const { isAuthenticated } = useAuth0();
    const column = useProjectCurationColumn(props.columnIndex);
    const prismaConfig = useProjectCurationPrismaConfig();
    const infoTags = useProjectCurationInfoTags();
    const exclusionTags = useProjectCurationExclusionTags();
    const [selectedTag, setSelectedTag] = useState<ITag>();
    const windowHeight = useGetWindowHeight();
    const [tags, setTags] = useState<ITag[]>([]);
    const [dialogState, setDialogState] = useState<{
        isOpen: boolean;
        stubId: string | undefined;
    }>({
        isOpen: false,
        stubId: undefined,
    });

    useEffect(() => {
        if (prismaConfig.isPrisma) {
            const phase = indexToPRISMAMapping(props.columnIndex);
            const exclusionTagsForThisColumn = phase ? prismaConfig[phase]?.exclusionTags : [];
            setTags(
                [...infoTags, ...exclusionTagsForThisColumn].sort((a, b) => {
                    if (a.isExclusionTag && b.isExclusionTag) {
                        return a.label.localeCompare(b.label);
                    } else if (!a.isExclusionTag && !b.isExclusionTag) {
                        return +a.isAssignable - +b.isAssignable;
                    } else {
                        return +b.isExclusionTag - +a.isExclusionTag;
                    }
                })
            );
        } else {
            setTags(
                [...infoTags, ...exclusionTags].sort((a, b) => {
                    if (a.isExclusionTag && b.isExclusionTag) {
                        return a.label.localeCompare(b.label);
                    } else if (!a.isExclusionTag && !b.isExclusionTag) {
                        return +a.isAssignable - +b.isAssignable;
                    } else {
                        return +b.isExclusionTag - +a.isExclusionTag;
                    }
                })
            );
        }
    }, [exclusionTags, infoTags, prismaConfig, props.columnIndex]);

    const handleSelectStub = React.useCallback((stubId: string) => {
        setDialogState({
            isOpen: true,
            stubId,
        });
    }, []);

    // This logic was previously in a useEffect hook, but was removed because it caused
    // visual flickering as the filteredStudies took noticable milliseconds to get updated
    const filteredStudies = useMemo(() => {
        return column.stubStudies.filter((stub) => getVisibility(stub, selectedTag));
    }, [column.stubStudies, selectedTag]);

    // 212 roughly represents the space taken up by other components above the column like buttons and headers
    const listHeightPx = windowHeight - 212 < 0 ? 0 : windowHeight - 212;

    const hasUncategorizedStudies = column.stubStudies.some((x) => x.exclusionTag === null);

    return (
        <Box sx={CurationColumnStyles.columnContainer}>
            <CurationDialog
                selectedFilter={selectedTag?.label || ''}
                onSetSelectedStub={handleSelectStub}
                selectedStubId={dialogState.stubId}
                columnIndex={props.columnIndex}
                stubs={filteredStudies}
                isOpen={dialogState.isOpen}
                onCloseDialog={() => setDialogState((prev) => ({ ...prev, isOpen: false }))}
            />
            <Button
                variant="contained"
                disableElevation
                onClick={() => {
                    const stubId = filteredStudies.length > 0 ? filteredStudies[0].id : undefined;
                    setDialogState({ stubId: stubId, isOpen: true });
                }}
                sx={{
                    padding: '8px',
                    marginBottom: '0.75rem',
                }}
            >
                {column.name} ({filteredStudies.length} of {column.stubStudies.length})
            </Button>

            {props.columnIndex === 0 && (
                <CurationPromoteUncategorizedButton
                    dialogTitle={
                        prismaConfig.isPrisma
                            ? 'Are you sure you want to promote all non duplicated studies in identification to screening?'
                            : 'Are you sure you want to skip curation?'
                    }
                    dialogMessage={
                        prismaConfig.isPrisma
                            ? 'All studies that have not been marked as duplicates in this stage will be promoted'
                            : 'All studies that have not been excluded in this stage will be included'
                    }
                    color="info"
                    variant="outlined"
                    disableElevation
                    sx={{
                        padding: '8px',
                        marginBottom: '0.75rem',
                        display: hasUncategorizedStudies ? 'block' : 'none',
                    }}
                    disabled={!isAuthenticated}
                >
                    {prismaConfig.isPrisma ? 'Promote Non Duplicated Studies' : 'Skip Curation'}
                </CurationPromoteUncategorizedButton>
            )}

            <Paper elevation={0} sx={{ width: '100%' }}>
                <Autocomplete
                    noOptionsText="No tags"
                    renderOption={(params, option) => (
                        <ListItem {...params} key={option?.id}>
                            <ListItemText
                                sx={{ color: option.isExclusionTag ? 'error.dark' : '' }}
                                primary={option?.label || ''}
                            />
                        </ListItem>
                    )}
                    value={selectedTag || null}
                    size="small"
                    groupBy={(option) => {
                        return option.isExclusionTag
                            ? 'Exclusion Tags'
                            : option.isAssignable
                              ? 'Your Tags'
                              : 'Default Tags';
                    }}
                    renderInput={(params) => <TextField {...params} label="filter" />}
                    options={tags}
                    isOptionEqualToValue={(option, value) => option?.id === value?.id}
                    getOptionLabel={(option) => option?.label || ''}
                    onChange={(_event, newValue) => {
                        setSelectedTag(newValue || undefined);
                    }}
                />
            </Paper>

            <Divider sx={{ margin: '1rem 0' }} />

            <Droppable
                mode="virtual"
                droppableId={column.id}
                renderClone={(provided, snapshot, rubric) => (
                    <CurationStubStudyDraggableContainer
                        {...column.stubStudies[rubric.source.index]}
                        index={rubric.source.index}
                        provided={provided}
                        snapshot={snapshot}
                        style={{}}
                        isVisible={true}
                        onSelectStubStudy={handleSelectStub}
                        columnIndex={props.columnIndex}
                    />
                )}
            >
                {(provided) => (
                    <VirtualizedList
                        rows={filteredStudies}
                        rowHeightInPx={ROW_HEIGHT_PX}
                        listHeightInPx={listHeightPx}
                        overscan={3}
                        getItemKey={(stub) => stub.id}
                        scrollContainerRef={provided.innerRef}
                        renderRow={(stub, style, index) => (
                            <VirtualizedColumnRow
                                stub={stub}
                                index={index}
                                columnIndex={props.columnIndex}
                                onSelectStub={handleSelectStub}
                                selectedTag={selectedTag}
                                style={style}
                            />
                        )}
                    />
                )}
            </Droppable>
        </Box>
    );
});

export default CurationColumn;
