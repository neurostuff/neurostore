import { DraggableProvided, DraggableStateSnapshot, DraggableStyle } from '@hello-pangea/dnd';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { Box, Paper } from '@mui/material';
import useUserCanEdit from 'hooks/useUserCanEdit';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import { useProjectUser } from 'pages/Project/store/ProjectStore';
import React from 'react';
import CurationStubStudy from './CurationStubStudy';
import CurationStubStudyStyles from './CurationStubStudy.styles';

const handleAnimation = (style: DraggableStyle | undefined, snapshot: DraggableStateSnapshot) => {
    if (!snapshot.isDropAnimating) {
        return style;
    }
    return {
        ...style,
        // cannot be 0, but make it super tiny
        transitionDuration: `0.001s`,
    };
};

const CurationStubStudyDraggableContainer: React.FC<
    ICurationStubStudy & {
        index: number;
        isVisible: boolean;
        columnIndex: number;
        provided: DraggableProvided;
        snapshot: DraggableStateSnapshot;
        style: React.CSSProperties;
        onSelectStubStudy: (stubId: string) => void;
    }
> = (props) => {
    const projectUser = useProjectUser();
    const canEdit = useUserCanEdit(projectUser || undefined);

    return (
        <Paper
            onClick={() => props.onSelectStubStudy(props.id)}
            elevation={1}
            {...props.provided.draggableProps}
            ref={props.provided.innerRef}
            style={{
                ...handleAnimation(props.provided.draggableProps.style, props.snapshot),
                ...props.style,
                ...{
                    display: props.isVisible ? 'flex' : 'none',
                    height: props.isVisible ? '120px' : '0px',
                    paddingTop: '7px',
                    paddingBottom: '5px',
                    marginBottom: '8px',
                    backgroundColor: props.snapshot.isDragging ? 'lightgray' : '',
                },
            }}
            sx={CurationStubStudyStyles.stubStudyContainer}
        >
            {!props?.exclusionTagId && canEdit ? (
                <Box
                    {...props.provided.dragHandleProps}
                    sx={{ display: 'flex', alignItems: 'center', width: '30px' }}
                >
                    <Box>
                        {/* // eslint-disable-next-line react/jsx-no-undef */}
                        <DragIndicatorIcon sx={{ color: 'gray' }} />
                    </Box>
                </Box>
            ) : (
                <Box sx={{ width: '30px' }}></Box>
            )}
            <CurationStubStudy {...props} />
        </Paper>
    );
};

export default CurationStubStudyDraggableContainer;
