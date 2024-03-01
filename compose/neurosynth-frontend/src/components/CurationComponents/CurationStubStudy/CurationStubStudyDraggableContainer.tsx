import { Box, Paper } from '@mui/material';
import { ISource, ITag } from 'hooks/projects/useGetProjects';
import React from 'react';
import CurationStubStudy from './CurationStubStudy';
import CurationStubStudyStyles from './CurationStubStudy.styles';
import { DraggableProvided, DraggableStateSnapshot, DraggableStyle } from '@hello-pangea/dnd';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';

export interface ICurationStubStudy {
    id: string;
    title: string;
    authors: string;
    keywords: string;
    pmid: string;
    pmcid: string;
    doi: string;
    articleYear: string | undefined;
    journal: string;
    abstractText: string;
    articleLink: string;
    exclusionTag: ITag | null;
    identificationSource: ISource;
    tags: ITag[];
    neurostoreId?: string;
    searchTerm?: string;
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
                    height: props.isVisible ? '120px' : '0px',
                    paddingTop: '7px',
                    paddingBottom: '5px',
                    marginBottom: '8px',
                    backgroundColor: props.snapshot.isDragging ? 'lightgray' : '',
                },
            }}
            sx={CurationStubStudyStyles.stubStudyContainer}
        >
            {!props?.exclusionTag ? (
                <Box
                    // remove drag and drop for now as it is unused
                    {...props.provided.dragHandleProps}
                    sx={{ display: 'flex', alignItems: 'center', width: '30px' }}
                >
                    <Box>
                        {/* remove drag and drop for now as it is unused */}
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
