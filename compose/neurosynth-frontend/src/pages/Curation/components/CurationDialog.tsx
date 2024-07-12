import { Box, Typography } from '@mui/material';
import BaseDialog, { IDialog } from 'components/Dialogs/BaseDialog';
import { useEffect, useRef, useState } from 'react';
import CurationStubListItem from './CurationStubListItem';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import useGetWindowHeight from 'hooks/useGetWindowHeight';
import React from 'react';
import CurationEditableStubSummary from 'pages/Curation/components/CurationEditableStubSummary';

interface ICurationDialog {
    columnIndex: number;
    selectedFilter: string;
    selectedStubId: string | undefined;
    stubs: ICurationStubStudy[];
    onSetSelectedStub: (stub: string) => void;
}

const CurationDialogFixedSizeListRow: React.FC<
    ListChildComponentProps<{
        stubs: ICurationStubStudy[];
        selectedStubId: string | undefined;
        onSetSelectedStub: (stub: string) => void;
    }>
> = (props) => {
    const stub = props.data.stubs[props.index];
    const isSelected = props.data.selectedStubId === stub.id;

    return (
        <CurationStubListItem
            selected={isSelected}
            onSetSelectedStub={props.data.onSetSelectedStub}
            stub={stub}
            style={props.style}
        />
    );
};

const CurationDialog: React.FC<ICurationDialog & IDialog> = (props) => {
    const [stubs, setStubs] = useState<ICurationStubStudy[]>(props.stubs);
    const scrollableBoxRef = useRef<HTMLDivElement>(null);
    const selectedStub: ICurationStubStudy | undefined = props.stubs.find(
        (stub) => stub.id === props.selectedStubId
    );

    const windowHeight = useGetWindowHeight();

    useEffect(() => {
        setStubs(props.stubs);
    }, [props.stubs]);

    const handleMoveToNextStub = () => {
        if (selectedStub) {
            const stubIndex = props.stubs.findIndex((x) => x.id === selectedStub.id);
            if (stubIndex < 0) return;

            const nextStub = props.stubs[stubIndex + 1];
            if (!nextStub) return;
            props.onSetSelectedStub(nextStub.id);
        }
    };

    useEffect(() => {
        if (scrollableBoxRef.current) {
            scrollableBoxRef.current.scrollTo(0, 0);
        }
    }, [selectedStub?.id]);

    // cant use useRef as the listRef does not exist due to it being rendered
    // later as a dialog. useEffect also does not keep track of useRef value changes
    // https://stackoverflow.com/questions/60476155/is-it-safe-to-use-ref-current-as-useeffects-dependency-when-ref-points-to-a-dom
    const handleScrollTo = React.useCallback(
        (listRef: FixedSizeList) => {
            if (listRef) {
                const selectedItemIndex = props.stubs.findIndex(
                    (x) => x.id === props.selectedStubId
                );
                listRef.scrollToItem(selectedItemIndex, 'smart');
            }
        },
        [props.selectedStubId, props.stubs]
    );

    // 60vh
    const pxInVh = Math.round((windowHeight * 60) / 100);

    if (stubs.length === 0) {
        return (
            <BaseDialog
                maxWidth="xl"
                fullWidth
                onCloseDialog={props.onCloseDialog}
                isOpen={props.isOpen}
                dialogTitle={`Curation View ${
                    props.selectedFilter ? `(Filtering for ${props.selectedFilter})` : ''
                }`}
            >
                <Typography sx={{ color: 'warning.dark' }}>No studies</Typography>
            </BaseDialog>
        );
    }

    return (
        <BaseDialog
            maxWidth="xl"
            fullWidth
            onCloseDialog={props.onCloseDialog}
            isOpen={props.isOpen}
            dialogTitle={`Curation View ${
                props.selectedFilter ? `(Filtering for ${props.selectedFilter})` : ''
            }`}
        >
            <Box sx={{ display: 'flex', height: '60vh' }}>
                <Box>
                    <FixedSizeList
                        height={pxInVh}
                        itemCount={stubs.length}
                        width={280}
                        itemSize={90}
                        itemKey={(index, data) => data.stubs[index]?.id}
                        itemData={{
                            stubs: stubs,
                            selectedStubId: props.selectedStubId,
                            onSetSelectedStub: props.onSetSelectedStub,
                        }}
                        layout="vertical"
                        overscanCount={3}
                        ref={handleScrollTo}
                    >
                        {CurationDialogFixedSizeListRow}
                    </FixedSizeList>
                </Box>
                <Box ref={scrollableBoxRef} sx={{ flexGrow: 1, overflowY: 'auto' }}>
                    <CurationEditableStubSummary
                        onMoveToNextStub={handleMoveToNextStub}
                        columnIndex={props.columnIndex}
                        stub={selectedStub}
                    />
                </Box>
            </Box>
        </BaseDialog>
    );
};

export default CurationDialog;
