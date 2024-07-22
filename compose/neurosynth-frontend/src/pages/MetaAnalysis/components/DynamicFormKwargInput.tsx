import { Box, Button, Divider, TableCell, TableRow, Typography, IconButton } from '@mui/material';
import { useState } from 'react';
import { IMetadataRowModel } from 'components/EditMetadata/EditMetadata.types';
import AddMetadataRow from 'components/EditMetadata/AddMetadataRow';
import { IDynamicFormInput } from 'pages/MetaAnalysis/components/DynamicForm.types';
import MetaAnalysisDynamicFormTitle from './MetaAnalysisDynamicFormTitle';
import NeurosynthTable from 'components/NeurosynthTable/NeurosynthTable';
import RemoveCircle from '@mui/icons-material/RemoveCircle';
import DynamicFormStyles from 'pages/MetaAnalysis/components//DynamicFormStyles';

const DynamicFormKwargInput: React.FC<IDynamicFormInput> = (props) => {
    const kwargList: { key: string; value: string }[] = Object.keys(props.value || {}).map(
        (key) => ({
            key: key,
            value: props.value[key],
        })
    );

    const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

    const handleDeleteKwarg = (id: string) => {
        const newObj = { ...props.value };
        delete newObj[id];
        props.onUpdate({
            [props.parameterName]: newObj,
        });
    };

    const handleOnAddMetadataRow = (row: IMetadataRowModel) => {
        if (row.metadataKey in props.value) return false;
        const newObj = { ...props.value };
        newObj[row.metadataKey] = row.metadataValue;

        props.onUpdate({
            [props.parameterName]: newObj,
        });
        return true;
    };

    return (
        <Box sx={DynamicFormStyles.input}>
            <Button
                onClick={() => setShowAdvancedOptions((prevState) => !prevState)}
                sx={{ marginBottom: '1rem' }}
                variant="text"
            >
                {showAdvancedOptions ? 'hide' : 'show'} advanced
            </Button>
            <Box sx={{ display: showAdvancedOptions ? 'block' : 'none' }}>
                <Divider sx={{ marginBottom: '1rem' }} />

                <MetaAnalysisDynamicFormTitle
                    name={props.parameterName}
                    description={props.parameter.description}
                />

                <Box>
                    <Box
                        sx={{
                            display: 'block',
                            borderCollapse: 'separate',
                            borderSpacing: '5px 0',
                            height: '70px',
                        }}
                    >
                        <AddMetadataRow
                            keyPlaceholderText="new variable"
                            valuePlaceholderText="new argument"
                            errorMessage="all variables must be unique"
                            showToggleType={false}
                            onAddMetadataRow={handleOnAddMetadataRow}
                        />
                    </Box>
                    <Box sx={{ width: '100%' }}>
                        <NeurosynthTable
                            tableConfig={{
                                isLoading: false,
                                tableHeaderBackgroundColor: 'transparent',
                                tableElevation: 0,
                                noDataDisplay: (
                                    <Typography color="warning.dark" style={{ padding: '1rem' }}>
                                        No keyword arguments
                                    </Typography>
                                ),
                            }}
                            headerCells={[
                                {
                                    text: 'Variable',
                                    key: 'variable',
                                    styles: { fontWeight: 'bold' },
                                },
                                {
                                    text: 'Argument',
                                    key: 'argument',
                                    styles: { fontWeight: 'bold' },
                                },
                                {
                                    text: '',
                                    key: 'deleteRow',
                                    styles: {},
                                },
                            ]}
                            rows={kwargList.map((kwarg) => (
                                <TableRow key={kwarg.key}>
                                    <TableCell>{kwarg.key}</TableCell>
                                    <TableCell>{kwarg.value}</TableCell>
                                    <TableCell>
                                        <IconButton onClick={() => handleDeleteKwarg(kwarg.key)}>
                                            <RemoveCircle color="error" />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                        />
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};

export default DynamicFormKwargInput;
