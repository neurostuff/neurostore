import { Box, Button, TextField, Typography } from '@mui/material';
import BaseDialog from 'components/Dialogs/BaseDialog';
import EditMetadata from 'components/EditMetadata/EditMetadata';
import { IMetadataRowModel } from 'components/EditMetadata/EditMetadata.types';
import { arrayToMetadata, metadataToArray } from 'pages/StudyCBMA/components/EditStudyMetadata';
import { useSnackbar } from 'notistack';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { StudyDetails } from 'stores/study/StudyStore.helpers';
import { useGetStudyNonNestedById, useUpdateStudy, useUserCanEdit } from 'hooks';
import useCloneStudy from 'pages/StudyIBMA/hooks/useCloneStudy';
import LoadingButton from 'components/Buttons/LoadingButton';
import { StudyRequest } from 'neurostore-typescript-sdk';

const sectionTitleSx = {
    fontWeight: 600,
    color: 'secondary.main',
    mb: 2,
} as const;

const fieldSpacing = { width: '100%', marginBottom: '0.75rem' } as const;

const EditStudyDetailsDialogIBMA: React.FC<{
    isOpen: boolean;
    onClose: () => void;
}> = ({ isOpen, onClose }) => {
    const { projectId, studyId } = useParams<{ projectId: string; studyId: string }>();
    const { data: study } = useGetStudyNonNestedById(studyId);
    const { mutateAsync: updateStudy, isLoading: updateStudyIsLoading } = useUpdateStudy();
    const { enqueueSnackbar } = useSnackbar();
    const [touched, setTouched] = useState(false);
    const userOwnsThisStudy = useUserCanEdit(study?.user ?? undefined);
    const { cloneStudy, isLoading: cloneStudyIsLoading } = useCloneStudy();
    const navigate = useNavigate();

    const isLoading = updateStudyIsLoading || cloneStudyIsLoading;

    const [form, setForm] = useState<{
        name: string;
        description: string;
        authors: string;
        publication: string;
        doi: string;
        pmid: string;
        pmcid: string;
        year: number | undefined;
        metadata: IMetadataRowModel[];
    } | null>(null);

    const resetFormWithStudyState = useCallback(() => {
        if (!study) return;
        setForm({
            name: study.name ?? '',
            description: study.description ?? '',
            authors: study.authors ?? '',
            publication: study.publication ?? '',
            doi: study.doi ?? '',
            pmid: study.pmid ?? '',
            pmcid: study.pmcid ?? '',
            year: study.year ?? undefined,
            metadata: metadataToArray(study.metadata as object | undefined),
        });
    }, [study]);

    useEffect(() => {
        if (!isOpen) {
            setForm(null);
            setTouched(false);
            return;
        }
        if (!study) return;
        resetFormWithStudyState();
        setTouched(false);
    }, [isOpen, study]);

    const handleClose = () => {
        if (study) {
            resetFormWithStudyState();
        }
        onClose();
    };

    const handleSave = async () => {
        if (!study?.id || !form) return;

        const studyRequest: StudyRequest = {
            name: form.name || undefined,
            description: form.description || undefined,
            authors: form.authors || undefined,
            publication: form.publication || undefined,
            doi: form.doi ? form.doi : undefined,
            pmid: form.pmid ? form.pmid : undefined,
            pmcid: form.pmcid ? form.pmcid : undefined,
            year: form.year,
            metadata: arrayToMetadata(form.metadata),
            analyses: study.analyses,
        };

        try {
            if (userOwnsThisStudy) {
                await updateStudy({
                    studyId: study.id,
                    study: studyRequest,
                });
                enqueueSnackbar('Study saved', { variant: 'success' });
                return;
            }

            const clonedStudyId = await cloneStudy(studyRequest);
            enqueueSnackbar('Study cloned and saved', { variant: 'success' });
            navigate(`/projects/${projectId}/extraction/studies/${clonedStudyId}/edit`);
        } catch {
            enqueueSnackbar('There was an error saving the study', { variant: 'error' });
        }
    };

    const handleUpdate = (update: string, field: keyof StudyDetails) => {
        setTouched(true);
        setForm((prev) => {
            if (!prev) return prev;
            if (field === 'year') {
                const updatedYear = parseInt(update, 10);
                if (Number.isNaN(updatedYear)) {
                    return { ...prev, year: undefined };
                }
                return { ...prev, year: updatedYear };
            }
            return { ...prev, [field]: update };
        });
    };

    const handleMetadataRowEdit = useCallback((updatedRow: IMetadataRowModel) => {
        setTouched(true);
        setForm((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                metadata: prev.metadata.map((row) => (row.metadataKey === updatedRow.metadataKey ? updatedRow : row)),
            };
        });
    }, []);

    const handleMetadataRowDelete = useCallback((updatedRow: IMetadataRowModel) => {
        setTouched(true);
        setForm((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                metadata: prev.metadata.filter((row) => row.metadataKey !== updatedRow.metadataKey),
            };
        });
    }, []);

    const handleMetadataRowAdd = useCallback(
        (row: IMetadataRowModel): boolean => {
            setTouched(true);
            if (!form) return false;
            const foundIndex = form.metadata.findIndex((x) => x.metadataKey === row.metadataKey);
            if (foundIndex >= 0) return false;
            setForm({ ...form, metadata: [row, ...form.metadata] });
            return true;
        },
        [form]
    );

    const name = form?.name ?? '';
    const description = form?.description ?? '';
    const authors = form?.authors ?? '';
    const publication = form?.publication ?? '';
    const doi = form?.doi ?? '';
    const pmid = form?.pmid ?? '';
    const pmcid = form?.pmcid ?? '';
    const year = form?.year ?? undefined;
    const metadata = form?.metadata ?? [];

    return (
        <BaseDialog
            isOpen={isOpen}
            dialogTitle="Edit study details"
            onCloseDialog={handleClose}
            fullWidth
            maxWidth="md"
            dialogContentSx={{ px: 3, pt: 1, pb: 0, overflow: 'auto' }}
        >
            <Box data-testid="edit-study-ibma-details-dialog" sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {!study || !form ? (
                    <Typography variant="body2" color="text.secondary">
                        Loading study…
                    </Typography>
                ) : (
                    <>
                        <Box>
                            <Typography variant="subtitle2" sx={sectionTitleSx}>
                                Study details
                            </Typography>
                            <TextField
                                label="Title"
                                size="small"
                                sx={fieldSpacing}
                                value={name}
                                onChange={(event) => handleUpdate(event.target.value, 'name')}
                            />
                            <TextField
                                label="Authors"
                                size="small"
                                sx={fieldSpacing}
                                value={authors}
                                onChange={(event) => handleUpdate(event.target.value, 'authors')}
                            />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                                <TextField
                                    label="Journal"
                                    size="small"
                                    sx={{ flex: '1 1 48%', minWidth: '12rem', marginBottom: '0.75rem' }}
                                    value={publication}
                                    onChange={(event) => handleUpdate(event.target.value, 'publication')}
                                />
                                <TextField
                                    label="DOI"
                                    size="small"
                                    sx={{ flex: '1 1 48%', minWidth: '12rem', marginBottom: '0.75rem' }}
                                    value={doi}
                                    onChange={(event) => handleUpdate(event.target.value, 'doi')}
                                />
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                                <TextField
                                    label="PMID"
                                    size="small"
                                    sx={{ flex: '1 1 30%', minWidth: '8rem', marginBottom: '0.75rem' }}
                                    value={pmid}
                                    onChange={(event) => handleUpdate(event.target.value, 'pmid')}
                                />
                                <TextField
                                    label="PMCID"
                                    size="small"
                                    sx={{ flex: '1 1 30%', minWidth: '8rem', marginBottom: '0.75rem' }}
                                    value={pmcid}
                                    onChange={(event) => handleUpdate(event.target.value, 'pmcid')}
                                />
                                <TextField
                                    onWheel={(event) => {
                                        event.preventDefault();
                                    }}
                                    label="Year"
                                    size="small"
                                    sx={{ flex: '1 1 30%', minWidth: '8rem', marginBottom: '0.75rem' }}
                                    type="number"
                                    value={year}
                                    onChange={(event) => handleUpdate(event.target.value, 'year')}
                                />
                            </Box>
                            <TextField
                                label="Description or abstract"
                                size="small"
                                sx={{ width: '100%' }}
                                value={description}
                                multiline
                                minRows={3}
                                onChange={(event) => handleUpdate(event.target.value, 'description')}
                            />
                        </Box>

                        <Box>
                            <Typography variant="subtitle2" sx={sectionTitleSx}>
                                Metadata
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                Custom key-value fields (for example sample size). Keys must be unique.
                            </Typography>
                            <EditMetadata
                                onMetadataRowAdd={handleMetadataRowAdd}
                                onMetadataRowEdit={handleMetadataRowEdit}
                                onMetadataRowDelete={handleMetadataRowDelete}
                                metadata={metadata}
                            />
                        </Box>
                    </>
                )}

                <Box
                    sx={{
                        position: 'sticky',
                        bottom: 0,
                        backgroundColor: 'background.paper',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: 1,
                        pb: 1,
                        pt: 1,
                    }}
                >
                    <Button
                        variant="outlined"
                        color="primary"
                        disableElevation
                        disabled={updateStudyIsLoading}
                        onClick={handleClose}
                    >
                        Close
                    </Button>
                    <LoadingButton
                        variant="contained"
                        text="Save"
                        loaderColor="secondary"
                        color="primary"
                        disableElevation
                        isLoading={isLoading}
                        disabled={!touched || updateStudyIsLoading || !study || !form}
                        onClick={handleSave}
                    ></LoadingButton>
                </Box>
            </Box>
        </BaseDialog>
    );
};

export default EditStudyDetailsDialogIBMA;
