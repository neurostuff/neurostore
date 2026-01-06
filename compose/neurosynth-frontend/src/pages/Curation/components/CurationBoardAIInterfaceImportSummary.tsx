import { Close, Delete } from '@mui/icons-material';
import { Alert, Box, Button, Chip, IconButton, Typography } from '@mui/material';
import DebouncedTextField from 'components/DebouncedTextField';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';
import { useGetWindowHeight, useUserCanEdit } from 'hooks';
import CurationImportFinalizeReviewVirtualizedListItem from 'pages/CurationImport/components/CurationImportFinalizeReviewVirtualizedListItem';
import { EImportMode } from 'pages/CurationImport/CurationImport.types';
import { useProjectCurationColumns, useProjectCurationImport } from 'pages/Project/store/ProjectStore';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FixedSizeList } from 'react-window';
import { ICurationStubStudy } from '../Curation.types';
import { IGroupListItem } from './CurationBoardAIGroupsList';
import { useAuth0 } from '@auth0/auth0-react';

const LIST_HEIGHT = 95;

const CurationBoardAIInterfaceImportSummary: React.FC<{
    group: IGroupListItem;
    onDeleteCurationImport: (curationImportId: string) => void;
}> = ({ group, onDeleteCurationImport }) => {
    const curationImport = useProjectCurationImport(group.id);
    const columns = useProjectCurationColumns();
    const [errorContainerHeight, setErrorContainerHeight] = useState<number>();
    const [descriptionContainerHeight, setDescriptionContainerHeight] = useState<number>();
    const errorTextContainerRef = useRef<HTMLDivElement>(null);
    const descriptionTextContainerRef = useRef<HTMLDivElement>(null);
    const windowHeight = useGetWindowHeight();
    const [confirmationDialogIsOpen, setConfirmationDialogIsOpen] = useState(false);
    const [searchText, setSearchText] = useState<string>();
    const { user } = useAuth0();
    const canEdit = useUserCanEdit(user?.sub || undefined);

    useEffect(() => {
        const totalHeight =
            (errorTextContainerRef.current?.offsetHeight || 0) + (errorTextContainerRef.current ? 8 : 0); // add margin
        setErrorContainerHeight(totalHeight);
    }, [errorTextContainerRef.current?.offsetHeight, group.id]);

    useEffect(() => {
        setDescriptionContainerHeight(descriptionTextContainerRef.current?.offsetHeight || 0);
    }, [descriptionTextContainerRef.current?.offsetHeight, group.id]);

    const studiesInImport = useMemo(() => {
        if (!curationImport?.id) return [];
        const allStudies = columns.reduce((acc, curr) => [...acc, ...curr.stubStudies], [] as ICurationStubStudy[]);
        return allStudies.filter((study) => study.importId === curationImport.id);
    }, [columns, curationImport]);

    const filteredStudies = useMemo(() => {
        if (!searchText) return studiesInImport;

        const searchTextLower = searchText.toLocaleLowerCase();

        return studiesInImport.filter(
            (study) =>
                study.title.toLocaleLowerCase()?.includes(searchTextLower) ||
                study.authors.toLocaleLowerCase()?.includes(searchTextLower) ||
                study.journal.toLocaleLowerCase()?.includes(searchTextLower)
        );
    }, [studiesInImport, searchText]);

    if (!curationImport) {
        return <Typography color="error.main">There was an error getting the import information</Typography>;
    }

    // Note: new Date('') yields "invalid date"
    const importDate = new Date(curationImport.date);
    let importMethodDescription = '';
    switch (curationImport.importModeUsed) {
        case EImportMode.FILE_IMPORT:
            importMethodDescription = 'These studies were imported using a file (RIS, endnote, or BibText).';
            break;
        case EImportMode.MANUAL_CREATE:
            importMethodDescription =
                'This study was created by manually entering the study details (name, description, authors, doi, etc).';
            break;
        case EImportMode.NEUROSTORE_IMPORT:
            importMethodDescription = "These studies were imported from neurostore's database.";
            break;
        case EImportMode.PUBMED_IMPORT:
            importMethodDescription = 'These studies were imported from a list of PubMed IDs.';
            break;
    }

    const listHeight = windowHeight - 356 - (errorContainerHeight || 0) - (descriptionContainerHeight || 0);

    return (
        <Box sx={{ padding: '1rem 2rem', overflowY: 'auto' }}>
            <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography
                        variant="h6"
                        fontWeight="bold"
                        gutterBottom={false}
                        sx={{
                            display: '-webkit-box',
                            WebkitLineClamp: 1,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            wordBreak: 'break-all',
                        }}
                    >
                        {curationImport?.name || ''}
                    </Typography>
                    <Box>
                        <ConfirmationDialog
                            dialogTitle="Are you sure you want to delete this import?"
                            onCloseDialog={(ok) => {
                                if (ok) onDeleteCurationImport(curationImport.id);
                                setConfirmationDialogIsOpen(false);
                            }}
                            rejectText="Cancel"
                            confirmText="Delete"
                            isOpen={confirmationDialogIsOpen}
                            rejectButtonProps={{
                                color: 'primary',
                            }}
                            confirmButtonProps={{
                                color: 'error',
                            }}
                        />
                        <Button
                            color="error"
                            sx={{ minWidth: '150px' }}
                            endIcon={<Delete />}
                            variant="contained"
                            disabled={!canEdit}
                            disableElevation
                            size="small"
                            onClick={() => setConfirmationDialogIsOpen(true)}
                        >
                            Delete import
                        </Button>
                    </Box>
                </Box>
                <Box ref={descriptionTextContainerRef}>
                    <Typography color="muted.main" variant="caption" sx={{ lineHeight: 'normal', fontWeight: 'bold' }}>
                        {importMethodDescription}
                    </Typography>
                    {curationImport.neurostoreSearchParams && (
                        <Typography
                            variant="caption"
                            color="muted.main"
                            sx={{ wordBreak: 'break-all', display: 'block' }}
                        >
                            Search: {curationImport.neurostoreSearchParams}
                        </Typography>
                    )}
                </Box>
                <Chip
                    sx={{ fontSize: '14px', height: '24px', marginTop: '4px' }}
                    label={`${importDate.toDateString()} ${importDate.toLocaleTimeString()}`}
                />
                {curationImport.errorsDuringImport && (
                    <Alert
                        ref={errorTextContainerRef}
                        severity="error"
                        variant="standard"
                        sx={{
                            marginTop: '8px',
                            padding: '0px 4px',
                            borderRadius: '4px',
                            fontSize: '14px',
                            '.MuiAlert-icon': { fontSize: '18px' },
                        }}
                    >
                        {curationImport.errorsDuringImport}
                    </Alert>
                )}
            </Box>
            <Box sx={{ backgroundColor: '#fafafa', padding: '0.5rem', borderRadius: '4px', marginTop: '8px' }}>
                <Box>
                    <DebouncedTextField
                        placeholder="Search by title, authors, or journal"
                        size="small"
                        onChange={setSearchText}
                        value={searchText}
                        InputProps={{
                            endAdornment: (
                                <IconButton size="small" onClick={() => setSearchText(undefined)}>
                                    <Close />
                                </IconButton>
                            ),
                        }}
                        sx={{
                            backgroundColor: 'white',
                            width: '100%',
                            marginBottom: '8px',
                            input: { padding: '7px 12px', fontSize: '14px' },
                        }}
                    />
                </Box>
                <FixedSizeList
                    height={listHeight < 0 ? 0 : listHeight}
                    itemCount={filteredStudies.length}
                    width="100%"
                    itemSize={LIST_HEIGHT}
                    itemKey={(index, data) => data.stubs[index]?.id}
                    layout="vertical"
                    itemData={{
                        stubs: filteredStudies,
                    }}
                    overscanCount={3}
                >
                    {({ index, data, style }) => {
                        const stub = data.stubs[index];
                        return <CurationImportFinalizeReviewVirtualizedListItem {...stub} style={style} />;
                    }}
                </FixedSizeList>
            </Box>
        </Box>
    );
};

export default CurationBoardAIInterfaceImportSummary;
