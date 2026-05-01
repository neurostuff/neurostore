import { Box, Button, FormControl, InputLabel, MenuItem, Select, TextField, Typography } from '@mui/material';
import BaseDialog from 'components/Dialogs/BaseDialog';
import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
import ToggleType from 'components/EditMetadata/ToggleType';
import { AnnotationNoteValue, NoteKeyType } from 'components/HotTables/HotTables.types';
import React, { useCallback, useEffect, useState } from 'react';

export type NewAnnotationColumnPayload = Omit<NoteKeyType, 'order'>;

const NewAnnotationColumnDialog: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    existingKeys: string[];
    onAddColumn: (payload: NewAnnotationColumnPayload) => void;
}> = ({ isOpen, onClose, existingKeys, onAddColumn }) => {
    const [columnKey, setColumnKey] = useState('');
    const [columnType, setColumnType] = useState<EPropertyType>(EPropertyType.BOOLEAN);
    const [booleanDefault, setBoolean] = useState(false);
    const [stringDefault, setString] = useState('');
    const [numberDefault, setNumber] = useState('');
    const [keyError, setKeyError] = useState('');
    const [numberError, setNumberError] = useState('');

    const resetForm = useCallback(() => {
        setColumnKey('');
        setColumnType(EPropertyType.BOOLEAN);
        setBoolean(false);
        setString('');
        setNumber('');
        setKeyError('');
        setNumberError('');
    }, []);

    useEffect(() => {
        if (isOpen) {
            resetForm();
        }
    }, [isOpen, resetForm]);

    const handleTypeChange = (nextType: EPropertyType) => {
        setColumnType(nextType);
        setNumberError('');
        if (nextType === EPropertyType.BOOLEAN) {
            setBoolean(false);
        }
        if (nextType === EPropertyType.STRING) {
            setString('');
        }
        if (nextType === EPropertyType.NUMBER) {
            setNumber('');
        }
    };

    const parseDefaultValue = (): AnnotationNoteValue | null => {
        switch (columnType) {
            case EPropertyType.BOOLEAN:
                return booleanDefault;
            case EPropertyType.STRING:
                return stringDefault === '' ? null : stringDefault;
            case EPropertyType.NUMBER: {
                const trimmed = numberDefault.trim();
                if (trimmed === '') return null;
                const parsed = Number(trimmed);
                if (Number.isNaN(parsed)) {
                    return null;
                }
                return parsed;
            }
            default:
                return null;
        }
    };

    const handleSave = () => {
        const trimmedKey = columnKey.trim();
        setKeyError('');
        setNumberError('');

        if (!trimmedKey) {
            setKeyError('Enter a column key');
            return;
        }

        if (existingKeys.includes(trimmedKey)) {
            setKeyError('A column with this key already exists');
            return;
        }

        if (columnType === EPropertyType.NUMBER) {
            const trimmed = numberDefault.trim();
            if (trimmed !== '' && Number.isNaN(Number(trimmed))) {
                setNumberError('Enter a valid number or leave blank for null');
                return;
            }
        }

        const defaultValue = parseDefaultValue();
        onAddColumn({
            key: trimmedKey,
            type: columnType,
            default: defaultValue,
        });
        resetForm();
        onClose();
    };

    const handleCancel = () => {
        resetForm();
        onClose();
    };

    return (
        <BaseDialog
            isOpen={isOpen}
            dialogTitle="New annotation column"
            onCloseDialog={handleCancel}
            fullWidth
            maxWidth="sm"
            dialogContentSx={{ pt: 1, pb: 2 }}
        >
            <Box data-testid="new-annotation-column-dialog" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="body2" color="text.secondary">
                    Choose a key, value type, and default for every study row in this annotation.
                </Typography>
                <TextField
                    label="Column key"
                    size="small"
                    value={columnKey}
                    onChange={(event) => setColumnKey(event.target.value)}
                    error={Boolean(keyError)}
                    helperText={keyError || undefined}
                    fullWidth
                    data-testid="new-annotation-column-key"
                />
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                    <Box data-testid="new-annotation-column-type">
                        <ToggleType
                            type={columnType}
                            onToggle={handleTypeChange}
                            allowNone={false}
                            allowBoolean
                            allowNumber
                            allowString
                        />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                        {columnType === EPropertyType.BOOLEAN ? (
                            <FormControl size="small" fullWidth>
                                <InputLabel id="new-annotation-column-bool-default-label">Default value</InputLabel>
                                <Select
                                    labelId="new-annotation-column-bool-default-label"
                                    label="Default value"
                                    value={booleanDefault ? 'true' : 'false'}
                                    onChange={(event) => setBoolean(event.target.value === 'true')}
                                    data-testid="new-annotation-column-default-boolean"
                                >
                                    <MenuItem value="false">false</MenuItem>
                                    <MenuItem value="true">true</MenuItem>
                                </Select>
                            </FormControl>
                        ) : null}
                        {columnType === EPropertyType.STRING ? (
                            <TextField
                                label="Default value (optional)"
                                size="small"
                                value={stringDefault}
                                onChange={(event) => setString(event.target.value)}
                                helperText="Leave blank for null"
                                fullWidth
                                data-testid="new-annotation-column-default-string"
                            />
                        ) : null}
                        {columnType === EPropertyType.NUMBER ? (
                            <TextField
                                label="Default value (optional)"
                                size="small"
                                value={numberDefault}
                                onChange={(event) => setNumber(event.target.value)}
                                error={Boolean(numberError)}
                                helperText={numberError || 'Leave blank for null'}
                                fullWidth
                                data-testid="new-annotation-column-default-number"
                            />
                        ) : null}
                    </Box>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, pt: 1 }}>
                    <Button variant="text" onClick={handleCancel}>
                        Cancel
                    </Button>
                    <Button variant="contained" disableElevation onClick={handleSave}>
                        Save
                    </Button>
                </Box>
            </Box>
        </BaseDialog>
    );
};

export default NewAnnotationColumnDialog;
