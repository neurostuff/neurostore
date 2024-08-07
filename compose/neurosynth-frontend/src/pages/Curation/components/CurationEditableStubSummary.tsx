import { Box, Button, Typography } from '@mui/material';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';
import TextEdit from 'components/TextEdit/TextEdit';
import { PUBMED_ARTICLE_URL_PREFIX } from 'hooks/external/useGetPubMedIds';
import { ISource } from 'hooks/projects/useGetProjects';
import useUserCanEdit from 'hooks/useUserCanEdit';
import {
    useDeleteStub,
    useProjectCurationColumns,
    useProjectUser,
    useUpdateStubField,
} from 'pages/Project/store/ProjectStore';
import React, { useState } from 'react';
import CurationEditableStubSummaryHeader from './CurationEditableStubSummaryHeader';
import DisplayStudyChipLinks from 'components/DisplayStudyChipLinks/DisplayStudyChipLinks';

interface ICurationEditableStubSummary {
    stub: ICurationStubStudy | undefined;
    columnIndex: number;
    onMoveToNextStub: () => void;
}

const CurationEditableStubSummary: React.FC<ICurationEditableStubSummary> = (props) => {
    const updateStubField = useUpdateStubField();
    const curationColumns = useProjectCurationColumns();
    const deleteStub = useDeleteStub();
    const [deleteStubConfirmationIsOpen, setDeleteStubConfirmationIsOpen] = useState(false);
    const projectUser = useProjectUser();
    const canEdit = useUserCanEdit(projectUser || undefined);

    const handleUpdateStub = (updatedText: string | number | ISource, label: string) => {
        if (!canEdit) return;
        const stubKey = label as unknown as keyof ICurationStubStudy;

        if (props.stub?.id) {
            // update the article link if PMID is being updated
            if (stubKey === 'pmid' && props.stub.articleLink.includes(PUBMED_ARTICLE_URL_PREFIX)) {
                updateStubField(
                    props.columnIndex,
                    props.stub.id,
                    'articleLink',
                    `${PUBMED_ARTICLE_URL_PREFIX}${updatedText}`
                );
            }

            updateStubField(props.columnIndex, props.stub.id, stubKey, updatedText);
        }
    };

    const handleCloseDialog = (confirm?: boolean) => {
        if (!props.stub?.id) return;

        setDeleteStubConfirmationIsOpen(false);

        if (confirm) {
            deleteStub(props.columnIndex, props.stub?.id);
            props.onMoveToNextStub();
        }
    };

    const isLastColumn = curationColumns.length - 1 === props.columnIndex;

    if (!props.stub) {
        return (
            <Box sx={{ padding: '2rem' }}>
                <Typography sx={{ color: 'warning.dark' }}>No study</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ padding: '0rem 2rem', minWidth: '585px' }}>
            <Box
                sx={{
                    position: 'sticky',
                    top: 0,
                    backgroundColor: 'white',
                    padding: '8px 0',
                    zIndex: 1000,
                }}
            >
                <CurationEditableStubSummaryHeader
                    type={
                        isLastColumn ? 'included' : props.stub.exclusionTag ? 'excluded' : 'default'
                    }
                    stub={props.stub}
                    columnIndex={props.columnIndex}
                    onMoveToNextStub={props.onMoveToNextStub}
                />
            </Box>

            <DisplayStudyChipLinks
                doi={props.stub.doi}
                pmid={props.stub.pmid}
                studyName={props.stub.title}
                pmcid={props.stub.pmcid}
            />

            <Box>
                <TextEdit
                    textFieldSx={{ input: { fontSize: '1.25rem' } }}
                    onSave={handleUpdateStub}
                    label="title"
                    textToEdit={props.stub.title}
                    editIconIsVisible={canEdit}
                >
                    <Typography
                        sx={{
                            color: props.stub.title ? '' : 'warning.dark',
                            fontWeight: props.stub.title ? 'bold' : 'normal',
                        }}
                        variant="h5"
                    >
                        {props.stub.title || 'No Title'}
                    </Typography>
                </TextEdit>
            </Box>

            <Typography sx={{ color: props.stub.authors ? '' : 'warning.dark' }} variant="h6">
                {props.stub.authors || 'No Authors'}
            </Typography>

            <Typography
                sx={{ color: props.stub.articleYear ? 'initial' : 'warning.dark' }}
                variant="h6"
            >
                Year: {props.stub.articleYear || 'No Year'}
            </Typography>

            <Box sx={{ display: 'flex' }}>
                <Typography
                    sx={{ color: props.stub.journal ? 'initial' : 'warning.dark' }}
                    variant="h6"
                >
                    {props.stub.journal || 'No Journal'}
                </Typography>
            </Box>

            <Box sx={{ display: 'flex' }}>
                <Typography sx={{ marginRight: '10px' }} variant="h6">
                    PMID:
                </Typography>
                <TextEdit
                    textFieldSx={{ input: { padding: 0, fontSize: '1.25rem' } }}
                    textToEdit={props.stub.pmid}
                    label="pmid"
                    onSave={handleUpdateStub}
                    editIconIsVisible={canEdit}
                >
                    <Typography
                        sx={{ color: props.stub.pmid ? 'initial' : 'warning.dark' }}
                        variant="h6"
                    >
                        {props.stub.pmid || 'No PMID'}
                    </Typography>
                </TextEdit>
            </Box>
            <Box sx={{ display: 'flex' }}>
                <Typography sx={{ marginRight: '10px' }} variant="h6">
                    PMCID:
                </Typography>
                <TextEdit
                    textFieldSx={{ input: { padding: 0, fontSize: '1.25rem' } }}
                    textToEdit={props.stub.pmcid}
                    label="pmcid"
                    onSave={handleUpdateStub}
                    editIconIsVisible={canEdit}
                >
                    <Typography
                        sx={{ color: props.stub.pmid ? 'initial' : 'warning.dark' }}
                        variant="h6"
                    >
                        {props.stub.pmcid || 'No PMCID'}
                    </Typography>
                </TextEdit>
            </Box>
            <Box sx={{ display: 'flex' }}>
                <Typography sx={{ marginRight: '10px' }} variant="h6">
                    DOI:
                </Typography>
                <TextEdit
                    textFieldSx={{ input: { padding: 0, fontSize: '1.25rem' } }}
                    onSave={handleUpdateStub}
                    label="doi"
                    textToEdit={props.stub.doi}
                    editIconIsVisible={canEdit}
                >
                    {props.stub.doi && (
                        <Typography
                            sx={{ color: props.stub.doi ? 'initial' : 'warning.dark' }}
                            variant="h6"
                        >
                            {props.stub.doi || 'No DOI'}
                        </Typography>
                    )}
                </TextEdit>
            </Box>

            <Typography
                sx={{
                    whiteSpace: 'break-spaces',
                    color: props.stub.identificationSource ? 'initial' : 'warning.dark',
                }}
            >
                Source: {props.stub.identificationSource?.label || 'No source'}
            </Typography>

            <Typography
                sx={{
                    color: props.stub.keywords ? 'initial' : 'warning.dark',
                    fontWeight: props.stub.keywords ? 'bold' : 'initial',
                }}
            >
                {props.stub.keywords || 'No Keywords'}
            </Typography>

            <Typography
                sx={{
                    whiteSpace: 'break-spaces',
                    color: props.stub.abstractText ? 'initial' : 'warning.dark',
                }}
            >
                {props.stub.abstractText || 'No Abstract'}
            </Typography>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <ConfirmationDialog
                    isOpen={deleteStubConfirmationIsOpen}
                    onCloseDialog={handleCloseDialog}
                    dialogTitle="Are you sure you want to delete this study?"
                    confirmText="Yes"
                    rejectText="Cancel"
                />
                <Button
                    onClick={() => setDeleteStubConfirmationIsOpen(true)}
                    variant="contained"
                    disableElevation
                    disabled={!canEdit}
                    color="error"
                >
                    Delete study
                </Button>
            </Box>
        </Box>
    );
};

export default CurationEditableStubSummary;
