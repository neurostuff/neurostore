import { DraggableProvided, DraggableStateSnapshot, DraggableStyle } from '@hello-pangea/dnd';
import { Box, Paper } from '@mui/material';
import { ISource, ITag } from 'hooks/requests/useGetProjects';
import CurationStubStudyStyles from './CurationStubStudy.styles';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import React from 'react';
import CurationStubStudy from './CurationStubStudy';

export interface ICurationStubStudy {
    id: string;
    title: string;
    authors: string;
    keywords: string;
    pmid: string;
    doi: string;
    articleYear: string | undefined;
    journal: string;
    abstractText: string;
    articleLink: string;
    exclusionTag: ITag | null;
    identificationSource: ISource;
    tags: ITag[];
}

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
                    height: props.isVisible
                        ? props.snapshot.isDragging
                            ? '132px'
                            : '120px'
                        : '0px',
                    paddingTop: '7px',
                    paddingBottom: props.snapshot.isDragging ? '0px' : '5px',
                    marginBottom: props.snapshot.isDragging ? '0px' : '8px',
                    backgroundColor: props.snapshot.isDragging ? 'lightgray' : '',
                },
            }}
            sx={CurationStubStudyStyles.stubStudyContainer}
        >
            {!props?.exclusionTag ? (
                <Box
                    {...props.provided.dragHandleProps}
                    sx={{ display: 'flex', alignItems: 'center', width: '30px' }}
                >
                    <Box>
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
