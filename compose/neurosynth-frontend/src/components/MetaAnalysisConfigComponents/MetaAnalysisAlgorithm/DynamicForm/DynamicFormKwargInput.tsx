import { Box, Button, Divider } from '@mui/material';
import { useState } from 'react';
import { DisplayValuesTable, IDisplayValuesTableModel } from '../../..';
import { IMetadataRowModel } from '../../../EditMetadata';
import AddMetadataRow from '../../../EditMetadata/EditMetadataRow/AddMetadataRow';
import MetaAnalysisAlgorithmStyles from '../MetaAnalysisAlgorithm.styles';
import { IDynamicFormInput } from '../..';
import DynamicFormBaseTitle from './DynamicFormBaseTitle';

const DynamicFormKwargInput: React.FC<IDynamicFormInput> = (props) => {
    const kwargList: { key: string; value: string }[] = Object.keys(props.value || {}).map(
        (key) => ({
            key: key,
            value: props.value[key],
        })
    );

    const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

    const handleActionSelected = (id: string) => {
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

    const dataForKwargsTable: IDisplayValuesTableModel = {
        columnHeaders: [
            { value: 'Variable', bold: true },
            { value: 'Argument', bold: true },
            { value: '' },
        ],
        paper: true,
        rowData: kwargList.map((kwarg) => ({
            uniqueKey: kwarg.key,
            columnValues: [
                {
                    value: kwarg.key,
                },
                {
                    value: kwarg.value,
                },
                {
                    value: 'delete',
                    isAction: true,
                    actionStyling: 'error',
                },
            ],
        })),
        onActionSelected: handleActionSelected,
    };

    return (
        <Box sx={MetaAnalysisAlgorithmStyles.input}>
            <Button
                onClick={() => setShowAdvancedOptions((prevState) => !prevState)}
                sx={{ marginBottom: '1rem' }}
                variant="text"
            >
                {showAdvancedOptions ? 'hide' : 'show'} advanced
            </Button>
            <Box sx={{ display: showAdvancedOptions ? 'block' : 'none' }}>
                <Divider sx={{ marginBottom: '1rem' }} />

                <DynamicFormBaseTitle
                    name={props.parameterName}
                    description={props.parameter.description}
                />

                <Box
                    sx={{
                        width: {
                            xl: '50%',
                            lg: '100%',
                        },
                    }}
                >
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
                        <DisplayValuesTable {...dataForKwargsTable} />
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};

export default DynamicFormKwargInput;
