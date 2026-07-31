import { Box, Typography } from '@mui/material';
import BaseDialog, { IDialog } from 'components/Dialogs/BaseDialog';
import VirtualizedList from 'components/VirtualizedList/VirtualizedList';
import useGetWindowHeight from 'hooks/useGetWindowHeight';
import CurationEditableStubSummary from 'pages/Curation/components/CurationEditableStubSummary';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import { useEffect, useMemo, useRef, useState } from 'react';
import CurationStubListItemVirtualizedContainer from './CurationStubListItemVirtualizedContainer';

const ROW_HEIGHT_PX = 90;
const LIST_WIDTH_PX = 280;

interface ICurationDialog {
    columnIndex: number;
    selectedFilter: string;
    selectedStubId: string | undefined;
    stubs: ICurationStubStudy[];
    onSetSelectedStub: (stub: string) => void;
}

const CurationDialog = (props: ICurationDialog & IDialog) => {
    const [stubs, setStubs] = useState<ICurationStubStudy[]>(props.stubs);
    const scrollableBoxRef = useRef<HTMLDivElement>(null);
    const selectedStub: ICurationStubStudy | undefined = props.stubs.find((stub) => stub.id === props.selectedStubId);

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

    // 60vh
    const pxInVh = Math.round((windowHeight * 60) / 100);

    const selectedItemIndex = useMemo(
        () => stubs.findIndex((stub) => stub.id === props.selectedStubId),
        [stubs, props.selectedStubId]
    );

    if (stubs.length === 0) {
        return (
            <BaseDialog
                maxWidth="xl"
                fullWidth
                onCloseDialog={props.onCloseDialog}
                isOpen={props.isOpen}
                dialogTitle={`Curation View ${props.selectedFilter ? `(Filtering for ${props.selectedFilter})` : ''}`}
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
            dialogTitle={`Curation View ${props.selectedFilter ? `(Filtering for ${props.selectedFilter})` : ''}`}
        >
            <Box sx={{ display: 'flex', height: '60vh' }}>
                <VirtualizedList
                    rows={stubs}
                    rowHeightInPx={ROW_HEIGHT_PX}
                    listHeightInPx={pxInVh}
                    width={LIST_WIDTH_PX}
                    overscan={3}
                    enabled={props.isOpen}
                    scrollToIndex={selectedItemIndex >= 0 ? selectedItemIndex : undefined}
                    scrollToAlign="center"
                    getItemKey={(stub) => stub.id}
                    renderRow={(stub, style) => (
                        <CurationStubListItemVirtualizedContainer
                            stub={stub}
                            selectedStubId={props.selectedStubId}
                            onSetSelectedStub={props.onSetSelectedStub}
                            style={style}
                        />
                    )}
                />
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
