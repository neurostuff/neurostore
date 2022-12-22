import { Box, List, Paper, Typography } from '@mui/material';
import BaseDialog, { IDialog } from 'components/Dialogs/BaseDialog';
import { useEffect, useState } from 'react';
import CurationStubSummary from 'components/Dialogs/CurationDialog/CurationStubSummary/CurationStubSummary';
import CurationStubListItem from './CurationStubListItem/CurationStubListItem';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudy';

interface ICurationDialog {
    columnIndex: number;
    selectedStubId: string | undefined;
    stubs: ICurationStubStudy[];
    onSetSelectedStub: (stub: string) => void;
}

const CurationDialog: React.FC<ICurationDialog & Omit<IDialog, 'dialogTitle'>> = (props) => {
    const [stubs, setStubs] = useState<ICurationStubStudy[]>(props.stubs);

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
                dialogTitle="Curation View"
            >
                <Typography sx={{ color: 'warning.dark' }}>No studies</Typography>
            </BaseDialog>
        );
    }

    const handleMoveToNextItem = () => {};

    const selectedStub = props.stubs.find((x) => x.id === props.selectedStubId);

    return (
        <BaseDialog
            maxWidth="xl"
            fullWidth
            onCloseDialog={props.onCloseDialog}
            isOpen={props.isOpen}
            dialogTitle="Curation View"
        >
            <Box sx={{ display: 'flex', height: '70vh', maxHeight: '70vh' }}>
                <Box
                    sx={{
                        minWidth: '250px',
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
                    <Box>
                        <CurationStubSummary
                            columnIndex={props.columnIndex}
                            onMoveToNextItem={handleMoveToNextItem}
                            stub={selectedStub}
                        />
                    </Box>
                </Box>
            </Box>
        </BaseDialog>
    );
};

export default CurationDialog;
