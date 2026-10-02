import { Box, Button, MenuItem, Select, Table, TableBody, TableCell, TableRow, TextField } from '@mui/material';
import LoadingButton from 'components/Buttons/LoadingButton';
import BaseDialog from 'components/Dialogs/BaseDialog';
import type { ImageReturn } from 'neurostore-typescript-sdk';
import { useEffect, useState } from 'react';

const IMAGE_VALUE_TYPES = {
    T: 'T map',
    Z: 'Z map',
    F: 'F map',
    X2: 'Chi squared map',
    P: 'P map (given null hypothesis)',
    IP: '1-P map ("inverted" probability)',
    M: 'multivariate-beta map',
    U: 'univariate-beta map',
    R: 'ROI/mask',
    Pa: 'parcellation',
    A: 'anatomical',
    V: 'variance',
    Other: 'other',
} as const;

export const IMAGE_VALUE_TYPE_OPTIONS = Object.values(IMAGE_VALUE_TYPES);

export const IMAGE_SPACE_OPTIONS = ['MNI', 'TAL', 'Other'] as const;

export type EditImageFieldsPayload = {
    filename: string | null;
    url: string | null;
    space: string | null;
    value_type: string | null;
};

const compactFieldSx = { '& .MuiOutlinedInput-input': { py: 0.5 } } as const;

const toNullable = (value: string) => {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

export const imageValueTypeLabel = (value: string | null | undefined): string => {
    if (!value) return '';
    if (value in IMAGE_VALUE_TYPES) return IMAGE_VALUE_TYPES[value as keyof typeof IMAGE_VALUE_TYPES];
    return IMAGE_VALUE_TYPE_OPTIONS.find((label) => label === value) ?? '';
};

const imageSpaceValue = (value: string | null | undefined): string =>
    value && (IMAGE_SPACE_OPTIONS as readonly string[]).includes(value) ? value : '';

const EditImageFieldsDialog: React.FC<{
    image: ImageReturn;
    isOpen: boolean;
    isLoading?: boolean;
    onClose: () => void;
    onSave?: (payload: EditImageFieldsPayload) => void | Promise<void>;
}> = ({ image, isOpen, isLoading = false, onClose, onSave }) => {
    const [filename, setFilename] = useState('');
    const [url, setUrl] = useState('');
    const [space, setSpace] = useState('');
    const [valueType, setValueType] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const saveIsLoading = isLoading || isSaving;

    useEffect(() => {
        if (!isOpen) return;
        setFilename(image.filename ?? '');
        setUrl(image.url ?? '');
        setSpace(imageSpaceValue(image.space));
        setValueType(imageValueTypeLabel(image.value_type));
    }, [image.filename, image.space, image.url, image.value_type, isOpen]);

    const handleSave = async () => {
        if (!onSave || saveIsLoading) return;
        setIsSaving(true);
        try {
            await onSave({
                filename: toNullable(filename),
                url: toNullable(url),
                space: toNullable(space),
                value_type: valueType || null,
            });
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <BaseDialog isOpen={isOpen} dialogTitle="Edit image" onCloseDialog={onClose} fullWidth maxWidth="sm">
            <Table size="small">
                <TableBody>
                    <TableRow>
                        <TableCell sx={{ padding: 0 }} width="36%">
                            filename
                        </TableCell>
                        <TableCell>
                            <TextField
                                size="small"
                                fullWidth
                                value={filename}
                                onChange={(event) => setFilename(event.target.value)}
                                inputProps={{ 'aria-label': 'filename' }}
                                sx={compactFieldSx}
                            />
                        </TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell sx={{ padding: 0 }} width="36%">
                            url
                        </TableCell>
                        <TableCell>
                            <TextField
                                size="small"
                                fullWidth
                                value={url}
                                onChange={(event) => setUrl(event.target.value)}
                                inputProps={{ 'aria-label': 'url' }}
                                sx={compactFieldSx}
                            />
                        </TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell sx={{ padding: 0 }} width="36%">
                            space
                        </TableCell>
                        <TableCell>
                            <Select
                                size="small"
                                fullWidth
                                displayEmpty
                                value={space}
                                onChange={(event) => setSpace(event.target.value)}
                                inputProps={{ 'aria-label': 'space' }}
                                sx={compactFieldSx}
                            >
                                {IMAGE_SPACE_OPTIONS.map((option) => (
                                    <MenuItem key={option} value={option}>
                                        {option}
                                    </MenuItem>
                                ))}
                            </Select>
                        </TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell sx={{ padding: 0 }} width="36%">
                            value_type
                        </TableCell>
                        <TableCell>
                            <Select
                                size="small"
                                fullWidth
                                displayEmpty
                                value={valueType}
                                onChange={(event) => setValueType(event.target.value)}
                                inputProps={{ 'aria-label': 'value_type' }}
                                sx={compactFieldSx}
                            >
                                {IMAGE_VALUE_TYPE_OPTIONS.map((option) => (
                                    <MenuItem key={option} value={option}>
                                        {option}
                                    </MenuItem>
                                ))}
                            </Select>
                        </TableCell>
                    </TableRow>
                </TableBody>
            </Table>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, pt: 2 }}>
                <Button onClick={onClose} variant="text">
                    Cancel
                </Button>
                <LoadingButton
                    isLoading={saveIsLoading}
                    loaderColor="secondary"
                    sx={{ width: '80px' }}
                    onClick={handleSave}
                    variant="contained"
                    color="primary"
                    disableElevation
                    text="Save"
                    disabled={!onSave}
                />
            </Box>
        </BaseDialog>
    );
};

export default EditImageFieldsDialog;
