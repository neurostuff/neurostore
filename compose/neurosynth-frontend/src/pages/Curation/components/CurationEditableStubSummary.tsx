import { Box, Typography } from '@mui/material';
import DisplayStudyLinkFullText from 'components/DisplayStudyLink/DisplayStudyLinkFullText';
import EditableDisplayLink from 'components/DisplayStudyLink/EditableDisplayLink';
import TextEdit from 'components/TextEdit/TextEdit';
import { PUBMED_ARTICLE_URL_PREFIX } from 'hooks/external/useGetPubMedIds';
import { ISource } from 'hooks/projects/useGetProjects';
import useUserCanEdit from 'hooks/useUserCanEdit';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import { useProjectCurationColumns, useProjectUser, useUpdateStubField } from 'pages/Project/store/ProjectStore';
import React from 'react';
import CurationEditableStubSummaryHeader from './CurationEditableStubSummaryHeader';

interface ICurationEditableStubSummary {
    stub: ICurationStubStudy | undefined;
    columnIndex: number;
    onMoveToNextStub: () => void;
}

const CurationEditableStubSummary: React.FC<ICurationEditableStubSummary> = ({
    stub,
    columnIndex,
    onMoveToNextStub,
}) => {
    const updateStubField = useUpdateStubField();
    const curationColumns = useProjectCurationColumns();
    const projectUser = useProjectUser();
    const canEdit = useUserCanEdit(projectUser || undefined);

    const handleUpdateStub = (updatedText: string | number | ISource, label: string) => {
        if (!canEdit) return;
        const stubKey = label as unknown as keyof ICurationStubStudy;

        if (stub?.id) {
            // update the article link if PMID is being updated
            if (stubKey === 'pmid' && stub.articleLink.includes(PUBMED_ARTICLE_URL_PREFIX)) {
                updateStubField(columnIndex, stub.id, 'articleLink', `${PUBMED_ARTICLE_URL_PREFIX}${updatedText}`);
            }

            updateStubField(columnIndex, stub.id, stubKey, updatedText);
        }
    };

    const isLastColumn = curationColumns.length - 1 === columnIndex;

    if (!stub) {
        return (
            <Box sx={{ padding: '2rem' }}>
                <Typography sx={{ color: 'warning.dark' }}>No study selected</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ padding: '0rem 1rem 1rem 1rem' }}>
            <Box
                sx={{
                    position: 'sticky',
                    top: 0,
                    backgroundColor: 'white',
                    zIndex: 1000,
                }}
            >
                <Box sx={{ display: 'flex' }}>
                    <EditableDisplayLink
                        stubId={stub.id}
                        linkProps={{ href: stub.doi }}
                        label="DOI Link"
                        noLabelText="No DOI"
                        textEditProps={{
                            editIconIsVisible: canEdit,
                            onSave: handleUpdateStub,
                            label: 'doi',
                            textToEdit: stub.doi,
                            placeholder: 'https://doi.org/10.1038/nmeth.1635',
                        }}
                    />
                    <EditableDisplayLink
                        stubId={stub.id}
                        linkProps={{ href: stub.pmid }}
                        label="Pubmed Study"
                        noLabelText="No PMID"
                        textEditProps={{
                            editIconIsVisible: canEdit,
                            onSave: handleUpdateStub,
                            label: 'pmid',
                            textToEdit: stub.pmid,
                            placeholder: '21706013',
                            textFieldSx: {
                                minWidth: '130px !important',
                                width: '130px !important',
                                maxWidth: '130px !important',
                            },
                        }}
                    />
                    <EditableDisplayLink
                        stubId={stub.id}
                        linkProps={{ href: stub.pmcid }}
                        label="PMCID"
                        noLabelText="No PMCID"
                        textEditProps={{
                            editIconIsVisible: canEdit,
                            onSave: handleUpdateStub,
                            label: 'pmcid',
                            textToEdit: stub.pmcid,
                            placeholder: 'PMC3146590',
                            textFieldSx: {
                                minWidth: '130px !important',
                                width: '130px !important',
                                maxWidth: '130px !important',
                            },
                        }}
                        tooltip="View the full article in HTML form via Pubmed Central"
                    />
                    {stub.title && <DisplayStudyLinkFullText studyName={stub.title} />}
                </Box>
                <CurationEditableStubSummaryHeader
                    type={isLastColumn ? 'included' : stub.exclusionTag ? 'excluded' : 'default'}
                    stub={stub}
                    columnIndex={columnIndex}
                    onMoveToNextStub={onMoveToNextStub}
                />
            </Box>

            <Box>
                <TextEdit
                    textFieldSx={{ input: { fontSize: '1.25rem' } }}
                    onSave={handleUpdateStub}
                    label="title"
                    multiline
                    textToEdit={stub.title}
                    editIconIsVisible={canEdit}
                >
                    <Typography
                        sx={{
                            color: stub.title ? '' : 'warning.dark',
                            fontWeight: stub.title ? 'bold' : 'normal',
                        }}
                        variant="h6"
                    >
                        {stub.articleYear ? `(${stub.articleYear}). ` : ''}
                        {stub.title || 'No Title'}
                    </Typography>
                </TextEdit>
            </Box>

            <Typography sx={{ color: stub.authors ? 'muted.dark' : 'warning.dark' }} variant="body2">
                {stub.authors || 'No Authors'}
            </Typography>

            <Typography sx={{ color: stub.journal ? 'muted.main' : 'warning.dark' }} variant="body2">
                {stub.journal || 'No Journal'}
            </Typography>

            <Typography
                variant="body2"
                sx={{
                    whiteSpace: 'break-spaces',
                    color: stub.identificationSource ? 'muted.main' : 'warning.dark',
                }}
            >
                Source: {stub.identificationSource?.label || 'No source'}
            </Typography>

            <Typography
                variant="body2"
                sx={{
                    color: stub.keywords ? 'initial' : 'warning.dark',
                    fontWeight: stub.keywords ? 'bold' : 'initial',
                    paddingBottom: '0.5rem',
                }}
            >
                {stub.keywords || 'No Keywords'}
            </Typography>

            <Typography
                variant="body2"
                sx={{
                    whiteSpace: 'break-spaces',
                    color: stub.abstractText ? 'initial' : 'warning.dark',
                }}
            >
                {stub.abstractText || 'No Abstract'}
            </Typography>
        </Box>
    );
};

export default CurationEditableStubSummary;
