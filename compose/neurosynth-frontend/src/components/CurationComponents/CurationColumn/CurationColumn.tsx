import { useAuth0 } from '@auth0/auth0-react';
import { Draggable, Droppable } from '@hello-pangea/dnd';
import {
    Autocomplete,
    Box,
    Button,
    Divider,
    ListItem,
    ListItemText,
    Paper,
    TextField,
} from '@mui/material';
import CurationStubStudyDraggableContainer, {
    ICurationStubStudy,
} from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog/ConfirmationDialog';
import CurationDialog from 'components/Dialogs/CurationDialog/CurationDialog';
import useGetWindowHeight from 'hooks/useGetWindowHeight';
import {
    useProjectCurationColumn,
    useProjectCurationExclusionTags,
    useProjectCurationInfoTags,
    useProjectCurationPrismaConfig,
    usePromoteAllUncategorized,
} from 'pages/Projects/ProjectPage/ProjectStore';
import { ENeurosynthTagIds } from 'pages/Projects/ProjectPage/ProjectStore.helpers';
import React, { useEffect, useMemo, useState } from 'react';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import CurationColumnStyles from './CurationColumn.styles';
import { ITag, indexToPRISMAMapping } from 'hooks/projects/useGetProjects';

export interface ICurationColumn {
    name: string;
    id: string;
    stubStudies: ICurationStubStudy[];
}

export const getVisibility = (stub: ICurationStubStudy, selectedTag: ITag | undefined): boolean => {
    let isVisible = false;
    if (!selectedTag) {
        isVisible = true;
    } else if (selectedTag.isExclusionTag) {
        isVisible = selectedTag.id === stub.exclusionTag?.id;
    } else if (selectedTag.id === ENeurosynthTagIds.UNTAGGED_TAG_ID) {
        isVisible = stub.tags.length === 0 && stub?.exclusionTag === null;
    } else if (selectedTag.id === ENeurosynthTagIds.UNCATEGORIZED_ID) {
        isVisible = stub?.exclusionTag === null;
    } else {
        isVisible = stub.tags.some((tag) => tag.id === selectedTag.id);
    }
    return isVisible;
};

const FixedSizeListRow: React.FC<
    ListChildComponentProps<{
        stubs: ICurationStubStudy[];
        columnIndex: number;
        onSelectStub: (stubId: string) => void;
        selectedTag: ITag | undefined;
    }>
> = (props) => {
    const stub = props.data.stubs[props.index];

    return (
        <Draggable
            draggableId={stub.id}
            index={props.index}
            isDragDisabled={!!stub?.exclusionTag}
            key={stub.id}
        >
            {(provided, snapshot) => (
                <CurationStubStudyDraggableContainer
                    {...stub}
                    provided={provided}
                    snapshot={snapshot}
                    index={props.index}
                    style={props.style}
                    isVisible={getVisibility(stub, props.data.selectedTag)}
                    onSelectStubStudy={props.data.onSelectStub}
                    columnIndex={props.data.columnIndex}
                />
            )}
        </Draggable>
    );
};

const CurationColumn: React.FC<{ columnIndex: number }> = React.memo((props) => {
    const { isAuthenticated } = useAuth0();
    const column = useProjectCurationColumn(props.columnIndex);
    const prismaConfig = useProjectCurationPrismaConfig();
    const infoTags = useProjectCurationInfoTags();
    const exclusionTags = useProjectCurationExclusionTags();
    const promoteAllUncategorized = usePromoteAllUncategorized();

    const [selectedTag, setSelectedTag] = useState<ITag>();
    const [warningDialogIsOpen, setWarningDialogIsOpen] = useState(false); // TODO: get rid of this
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

    const handlePromoteAllUnCategorized = (confirm?: boolean) => {
        if (confirm) {
            promoteAllUncategorized();
        }

        setWarningDialogIsOpen(false);
    };

    // This logic was previously in a useEffect hook, but was removed because it caused
    // visual flickering as the filteredStudies took noticable milliseconds to get updated
    const filteredStudies = useMemo(() => {
        return column.stubStudies.filter((stub) => getVisibility(stub, selectedTag));
    }, [column.stubStudies, selectedTag]);

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
                <>
                    <ConfirmationDialog
                        dialogTitle="Are you sure you want to promote all uncategorized studies?"
                        dialogMessage="Once you do this, it cannot be undone"
                        rejectText="Cancel"
                        confirmText="Promote All"
                        isOpen={warningDialogIsOpen}
                        onCloseDialog={handlePromoteAllUnCategorized}
                    />
                    <Button
                        variant="contained"
                        color="info"
                        disableElevation
                        onClick={() => setWarningDialogIsOpen(true)}
                        sx={{
                            padding: '8px',
                            marginBottom: '0.75rem',
                            display: hasUncategorizedStudies ? 'block' : 'none',
                        }}
                        disabled={!isAuthenticated}
                    >
                        Promote all uncategorized studies
                    </Button>
                </>
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
                    onChange={(_event, newValue, _reason) => {
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
                {(provided, snapshot) => (
                    <FixedSizeList
                        // 212 roughly represents the space taken up by other components above the column like buttons and headers
                        height={windowHeight - 212 < 0 ? 0 : windowHeight - 212}
                        outerRef={provided.innerRef}
                        itemCount={filteredStudies.length}
                        width="100%"
                        itemSize={140}
                        itemKey={(index, data) => data.stubs[index]?.id}
                        layout="vertical"
                        itemData={{
                            stubs: filteredStudies,
                            columnIndex: props.columnIndex,
                            onSelectStub: handleSelectStub,
                            selectedTag: selectedTag,
                        }}
                        overscanCount={3}
                    >
                        {FixedSizeListRow}
                    </FixedSizeList>
                )}
            </Droppable>
        </Box>
    );
});

export default CurationColumn;
