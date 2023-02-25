import { Draggable, DraggableStateSnapshot, DraggableStyle } from '@hello-pangea/dnd';
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
        onSelectStubStudy: (stubId: string) => void;
    }
> = React.memo((props) => {
    console.log('re render');
    return (
        <Draggable
            draggableId={props.id}
            index={props.index}
            isDragDisabled={!!props?.exclusionTag}
        >
            {(provided, snapshot) => (
                <Paper
                    onClick={() => props.onSelectStubStudy(props.id)}
                    elevation={1}
                    {...provided.draggableProps}
                    ref={provided.innerRef}
                    sx={[
                        CurationStubStudyStyles.stubStudyContainer,
                        {
                            display: props.isVisible ? 'flex' : 'none',
                        },
                    ]}
                    style={handleAnimation(provided.draggableProps.style, snapshot)}
                >
                    {!props?.exclusionTag ? (
                        <Box
                            {...provided.dragHandleProps}
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
            )}
        </Draggable>
    );
});

export default CurationStubStudyDraggableContainer;
