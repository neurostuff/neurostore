import { Box, List, Paper, Typography } from '@mui/material';
import BaseDialog, { IDialog } from 'components/Dialogs/BaseDialog';
import { useEffect, useState } from 'react';
import CurationStubSummary from 'components/Dialogs/CurationDialog/CurationStubSummary/CurationStubSummary';
import CurationStubListItem from './CurationStubListItem/CurationStubListItem';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudy';

interface ICurationDialog {
    columnIndex: number;
    selectedFilter: string;
    selectedStubId: string | undefined;
    stubs: ICurationStubStudy[];
    onSetSelectedStub: (stub: string) => void;
}

const CurationDialog: React.FC<ICurationDialog & IDialog> = (props) => {
    const [stubs, setStubs] = useState<ICurationStubStudy[]>(props.stubs);
    const selectedStub = props.stubs.find((x) => x.id === props.selectedStubId);

    useEffect(() => {
        setStubs(props.stubs);
    }, [props.stubs]);

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

    const handleMoveToNextStub = () => {
        if (selectedStub) {
            const stubIndex = props.stubs.findIndex((x) => x.id === selectedStub.id);
            if (stubIndex < 0) return;

            const nextStub = props.stubs[stubIndex + 1];
            if (!nextStub) return;
            props.onSetSelectedStub(nextStub.id);
        }
    };

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
            <Box sx={{ display: 'flex', height: '70vh', maxHeight: '70vh' }}>
                <Box
                    sx={{
                        minWidth: '250px',
                        maxWidth: '250px',
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%',
                    }}
                >
                    <Paper elevation={1} sx={{ overflowY: 'scroll', height: '100%' }}>
                        <List disablePadding sx={{ width: '100%' }}>
                            {stubs.map((stub) => (
                                <CurationStubListItem
                                    key={stub.id}
                                    stub={stub}
                                    selected={stub.id === props.selectedStubId}
                                    onSelect={() => props.onSetSelectedStub(stub.id)}
                                />
                            ))}
                        </List>
                    </Paper>
                </Box>
                <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
                    <CurationStubSummary
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
