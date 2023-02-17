import { Typography, Box, Link } from '@mui/material';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudy';
import React from 'react';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import { useParams } from 'react-router-dom';
import useUpdateCurationStub from 'hooks/requests/useUpdateCurationStub';
import TextEdit from 'components/TextEdit/TextEdit';
import IdentificationSourcePopup from 'components/CurationComponents/SelectorPopups/SourcePopup/SourcePopup';
import { ISource } from 'hooks/requests/useGetProjects';
import CurationStubSummaryHeader from './CurationStubSummaryHeader';

interface ICurationStubSummary {
    stub: ICurationStubStudy | undefined;
    columnIndex: number;
    onMoveToNextStub: () => void;
}

const CurationStubSummary: React.FC<ICurationStubSummary> = (props) => {
    const { projectId }: { projectId: string | undefined } = useParams();
    const { addExclusion, removeExclusion, addTag, removeTag, updateField, ...loadingState } =
        useUpdateCurationStub(projectId);
    const {
        data,
        isLoading: getProjectIsLoading,
        isError: getProjectIsError,
    } = useGetProjectById(projectId);

    const handleUpdateStub = (updatedText: string | number | ISource, label: string) => {
        if (props.stub?.id)
            updateField(
                props.columnIndex,
                props.stub.id,
                label as keyof ICurationStubStudy,
                updatedText
            );
    };

    if (!props.stub) {
        return (
            <Box sx={{ padding: '2rem' }}>
                <Typography sx={{ color: 'warning.dark' }}>No study</Typography>
            </Box>
        );
    }

    if (getProjectIsError) {
        return (
            <Box>
                <Typography color="error">There was an error</Typography>
            </Box>
        );
    }

    const isLastColumn =
        (data?.provenance?.curationMetadata?.columns || []).length - 1 === props.columnIndex;

    return (
        <Box sx={{ padding: '0rem 2rem', minWidth: '585px' }}>
            <CurationStubSummaryHeader
                type={isLastColumn ? 'included' : props.stub.exclusionTag ? 'excluded' : 'default'}
                stub={props.stub}
                columnIndex={props.columnIndex}
                onMoveToNextStub={props.onMoveToNextStub}
            />

            <Box sx={{ margin: '0.5rem 0', marginTop: '1rem' }}>
                <IdentificationSourcePopup
                    isLoading={loadingState.updateidentificationSourceIsLoading}
                    onAddSource={(source) => handleUpdateStub(source, 'identificationSource')}
                    onCreateSource={(source) => handleUpdateStub(source, 'identificationSource')}
                    initialValue={props.stub.identificationSource}
                    size="small"
                />
            </Box>

            <TextEdit
                sx={{ input: { fontSize: '1.25rem' } }}
                onSave={handleUpdateStub}
                label="title"
                isLoading={loadingState.updatetitleIsLoading}
                textToEdit={props.stub.title}
            >
                {props.stub.articleLink ? (
                    <Link
                        rel="noopener"
                        underline="hover"
                        color="primary"
                        target="_blank"
                        href={props.stub.articleLink}
                    >
                        <Typography variant="h6">{props.stub.title}</Typography>
                    </Link>
                ) : (
                    <Typography color="primary" variant="h5">
                        {props.stub.title}
                    </Typography>
                )}
            </TextEdit>

            <TextEdit
                sx={{ width: '100%', input: { fontSize: '1.25rem' } }}
                onSave={handleUpdateStub}
                isLoading={loadingState.updateauthorsIsLoading}
                label="authors"
                textToEdit={props.stub.authors}
            >
                <Typography
                    sx={{ color: props.stub.authors ? 'secondary.main' : 'warning.dark' }}
                    variant="h6"
                >
                    {props.stub.authors || 'No Authors'}
                </Typography>
            </TextEdit>
            <Box sx={{ display: 'flex' }}>
                <TextEdit
                    sx={{
                        width: '350px',
                        input: { padding: 0, fontSize: '1.25rem' },
                    }}
                    isLoading={loadingState.updatejournalIsLoading}
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
                    isLoading={loadingState.updatearticleYearIsLoading}
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
                    isLoading={loadingState.updatepmidIsLoading}
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
                    isLoading={loadingState.updatedoiIsLoading}
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

            <TextEdit
                label="keywords"
                onSave={handleUpdateStub}
                isLoading={loadingState.updatekeywordsIsLoading}
                textToEdit={props.stub.keywords}
            >
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
                isLoading={loadingState.updateabstractTextIsLoading}
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
        </Box>
    );
};

export default CurationStubSummary;
