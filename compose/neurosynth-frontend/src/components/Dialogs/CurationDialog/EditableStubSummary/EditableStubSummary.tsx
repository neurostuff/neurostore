import { Typography, Box, Button, Link } from '@mui/material';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import React from 'react';
import TextEdit from 'components/TextEdit/TextEdit';
import IdentificationSourcePopup from 'components/CurationComponents/SelectorPopups/SourcePopup/SourcePopup';
import { ISource } from 'hooks/requests/useGetProjects';
import EditableStubSummaryHeader from './EditableStubSummaryHeader';
import {
    useProjectCurationColumns,
    useUpdateStubField,
} from 'pages/Projects/ProjectPage/ProjectStore';
import { PUBMED_ARTICLE_URL_PREFIX } from 'hooks/requests/useGetPubMedIds';

interface IEditableStubSummary {
    stub: ICurationStubStudy | undefined;
    columnIndex: number;
    onMoveToNextStub: () => void;
}

const EditableStubSummary: React.FC<IEditableStubSummary> = (props) => {
    const updateStubField = useUpdateStubField();
    const curationColumns = useProjectCurationColumns();

    const handleUpdateStub = (updatedText: string | number | ISource, label: string) => {
        const stubKey = label as unknown as keyof ICurationStubStudy;

        if (props.stub?.id) {
            // update the article link is PMID is being updated
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
            <EditableStubSummaryHeader
                type={isLastColumn ? 'included' : props.stub.exclusionTag ? 'excluded' : 'default'}
                stub={props.stub}
                columnIndex={props.columnIndex}
                onMoveToNextStub={props.onMoveToNextStub}
            />

            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                }}
            >
                {props.stub.neurostoreId && (
                    <Link
                        underline="hover"
                        target="_blank"
                        href={`/studies/${props.stub.neurostoreId}`}
                        sx={{ marginRight: '10px' }}
                    >
                        view study in neurostore
                    </Link>
                )}
                {props.stub.pmid && (
                    <Link
                        underline="hover"
                        target="_blank"
                        href={`${PUBMED_ARTICLE_URL_PREFIX}${props.stub.pmid}`}
                        sx={{ marginRight: '10px' }}
                    >
                        view study in pubmed
                    </Link>
                )}
                <TextEdit
                    sx={{ width: '500px' }}
                    onSave={handleUpdateStub}
                    label="articleLink"
                    textToEdit={props.stub.articleLink}
                >
                    {props.stub.articleLink ? (
                        <Link
                            underline="hover"
                            target="_blank"
                            href={props.stub.articleLink}
                            sx={{ marginRight: '10px' }}
                        >
                            view article link
                        </Link>
                    ) : (
                        <Typography sx={{ color: 'warning.dark' }}>
                            No external article link
                        </Typography>
                    )}
                </TextEdit>
            </Box>

            <Box>
                <TextEdit
                    sx={{ input: { fontSize: '1.25rem' } }}
                    onSave={handleUpdateStub}
                    label="title"
                    textToEdit={props.stub.title}
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

            <TextEdit
                sx={{ width: '100%', input: { fontSize: '1.25rem' } }}
                onSave={handleUpdateStub}
                label="authors"
                textToEdit={props.stub.authors}
            >
                <Typography sx={{ color: props.stub.authors ? '' : 'warning.dark' }} variant="h6">
                    {props.stub.authors || 'No Authors'}
                </Typography>
            </TextEdit>
            <Box sx={{ display: 'flex' }}>
                <TextEdit
                    sx={{
                        width: '350px',
                        input: { padding: 0, fontSize: '1.25rem' },
                    }}
                    label="journal"
                    textToEdit={props.stub.journal}
                    onSave={handleUpdateStub}
                >
                    <Typography
                        sx={{ color: props.stub.journal ? 'initial' : 'warning.dark' }}
                        variant="h6"
                    >
                        {props.stub.journal || 'No Journal'}
                    </Typography>
                </TextEdit>
            </Box>
            <Box sx={{ display: 'flex' }}>
                <TextEdit
                    sx={{
                        width: '350px',
                        input: { padding: 0, fontSize: '1.25rem' },
                    }}
                    label="year"
                    fieldName="articleYear"
                    textToEdit={props.stub.articleYear || ''}
                    onSave={handleUpdateStub}
                >
                    <Typography
                        sx={{ color: props.stub.articleYear ? 'initial' : 'warning.dark' }}
                        variant="h6"
                    >
                        {props.stub.articleYear || 'No Year'}
                    </Typography>
                </TextEdit>
            </Box>
            <Box sx={{ display: 'flex' }}>
                <Typography sx={{ marginRight: '10px' }} variant="h6">
                    PMID:
                </Typography>
                <TextEdit
                    sx={{ input: { padding: 0, fontSize: '1.25rem' } }}
                    textToEdit={props.stub.pmid}
                    label="pmid"
                    onSave={handleUpdateStub}
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
                    DOI:
                </Typography>
                <TextEdit
                    sx={{ input: { padding: 0, fontSize: '1.25rem' } }}
                    onSave={handleUpdateStub}
                    label="doi"
                    textToEdit={props.stub.doi}
                >
                    <Typography
                        sx={{ color: props.stub.doi ? 'initial' : 'warning.dark' }}
                        variant="h6"
                    >
                        {props.stub.doi || 'No DOI'}
                    </Typography>
                </TextEdit>
            </Box>

            <TextEdit label="keywords" onSave={handleUpdateStub} textToEdit={props.stub.keywords}>
                <Typography
                    sx={{
                        color: props.stub.keywords ? 'initial' : 'warning.dark',
                        fontWeight: props.stub.keywords ? 'bold' : 'initial',
                    }}
                >
                    {props.stub.keywords || 'No Keywords'}
                </Typography>
            </TextEdit>
            <TextEdit
                label="description"
                onSave={handleUpdateStub}
                fieldName="abstractText"
                textToEdit={props.stub.abstractText}
                multiline
            >
                <Typography
                    sx={{
                        color: props.stub.abstractText ? 'initial' : 'warning.dark',
                    }}
                >
                    {props.stub.abstractText || 'No Abstract'}
                </Typography>
            </TextEdit>

            <Box sx={{ margin: '1rem 0' }}>
                <IdentificationSourcePopup
                    label="source"
                    onAddSource={(source) => handleUpdateStub(source, 'identificationSource')}
                    onCreateSource={(source) => handleUpdateStub(source, 'identificationSource')}
                    initialValue={props.stub.identificationSource}
                    size="small"
                />
            </Box>
        </Box>
    );
};

export default EditableStubSummary;
