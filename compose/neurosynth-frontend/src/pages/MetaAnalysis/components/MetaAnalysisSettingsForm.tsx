import { Autocomplete, Stack, TextField, Typography } from '@mui/material';
import LoadingButton from 'components/Buttons/LoadingButton';
import PrivacyToggle from 'components/PrivacyToggle';
import { useGetMetaAnalysisById, useUserCanEdit } from 'hooks';
import useUpdateMetaAnalysis from 'hooks/metaAnalyses/useUpdateMetaAnalysis';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useProjectUser } from 'stores/projects/ProjectStore';

export const tagNamesFromMetaAnalysis = (tags: Array<string> | null | undefined): string[] => {
    if (!tags) return [];

    const names: string[] = [];
    const seen = new Set<string>();
    tags.forEach((tag) => {
        const name = tag.trim();
        const key = name.toLowerCase();
        if (!name || seen.has(key)) return;
        seen.add(key);
        names.push(name);
    });
    return names;
};

const MetaAnalysisSettingsForm = () => {
    const { metaAnalysisId } = useParams<{ metaAnalysisId: string }>();
    const { data: metaAnalysis } = useGetMetaAnalysisById(metaAnalysisId);
    const projectUser = useProjectUser();
    const editsAllowed = useUserCanEdit(projectUser || undefined);
    const canEditMetaAnalysis = useUserCanEdit(metaAnalysis?.user || undefined);
    const canEdit = editsAllowed || canEditMetaAnalysis;

    const { mutate: updateMetaAnalysis, isPending: updateMetaAnalysisIsLoading } = useUpdateMetaAnalysis();

    const [name, setName] = useState(metaAnalysis?.name ?? '');
    const [description, setDescription] = useState(metaAnalysis?.description ?? '');
    const [isPublic, setIsPublic] = useState(metaAnalysis?.public ?? true);
    const [tags, setTags] = useState<string[]>(tagNamesFromMetaAnalysis(metaAnalysis?.tags ?? []));

    const handleSave = () => {
        if (!metaAnalysis?.id) return;
        updateMetaAnalysis({
            metaAnalysisId: metaAnalysis.id,
            metaAnalysis: {
                name,
                description,
                public: isPublic,
                tags,
            },
        });
    };

    return (
        <Stack spacing={2.5}>
            <Stack spacing={1}>
                <Typography variant="subtitle2" color="text.secondary">
                    Access
                </Typography>
                <PrivacyToggle
                    isPublic={isPublic}
                    canEdit={canEdit}
                    onChange={setIsPublic}
                    tooltipTitle="Toggle meta-analysis privacy"
                />
            </Stack>
            <TextField
                label="Name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={!canEdit}
                fullWidth
            />
            <TextField
                label="Description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={!canEdit}
                multiline
                minRows={4}
                fullWidth
            />
            <Autocomplete
                multiple
                freeSolo
                options={[] as string[]}
                value={tags}
                disabled={!canEdit}
                forcePopupIcon={false}
                onChange={(_event, next) => setTags(tagNamesFromMetaAnalysis(next))}
                renderInput={(params) => (
                    <TextField {...params} label="Tags" placeholder="Type a tag and press Enter" />
                )}
            />
            {canEdit && (
                <Stack direction="row" justifyContent="flex-end">
                    <LoadingButton
                        text="Save"
                        variant="contained"
                        disableElevation
                        isLoading={updateMetaAnalysisIsLoading}
                        onClick={handleSave}
                    />
                </Stack>
            )}
        </Stack>
    );
};

export default MetaAnalysisSettingsForm;
