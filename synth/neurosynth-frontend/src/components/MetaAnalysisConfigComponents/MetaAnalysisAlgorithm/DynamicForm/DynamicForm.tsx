import { Box } from '@mui/material';
import { IDynamicForm, IDynamicFormInput, IParameter, KWARG_STRING } from '../..';
import DynamicFormBoolInput from './DynamicFormBoolInput';
import DynamicFormKwargInput from './DynamicFormKwargInput';
import DynamicFormNumericInput from './DynamicFormNumericInput';
import DynamicFormSelectInput from './DynamicFormSelectInput';
import DynamicFormStringInput from './DynamicFormStringInput';

const DynamicForm: React.FC<IDynamicForm> = (props) => {
    const specs = Object.keys(props.specification).sort();

    const kwargStringIndex = specs.findIndex((spec) => spec === KWARG_STRING);
    if (kwargStringIndex >= 0) {
        specs.splice(kwargStringIndex, 1);
        specs.push(KWARG_STRING);
    }

    const parametersList: IDynamicFormInput[] = specs.map((parameter) => ({
        parameterName: parameter,
        parameter: props.specification[parameter],
        value: props.values[parameter],
        onUpdate: props.onUpdate,
    }));

    const getFormComponentBySpec = (spec: IParameter): React.FC<IDynamicFormInput> => {
        switch (spec.type) {
            case 'str':
                return DynamicFormStringInput;
            case 'int':
            case 'float':
                return DynamicFormNumericInput;
            case 'bool':
                return DynamicFormBoolInput;
            case null:
                return DynamicFormKwargInput;
            default:
                return DynamicFormSelectInput;
        }
    };

    return (
        <Box
            sx={{
                maxHeight: {
                    xs: '200px',
                    md: '350px',
                },
                overflowY: 'auto',
            }}
        >
            {parametersList.length > 0 &&
                parametersList.map((parameter) => {
                    const Component = getFormComponentBySpec(parameter.parameter);
                    return (
                        <Box key={parameter.parameterName}>
                            <Component {...parameter} />
                        </Box>
                    );
                })}
            {parametersList.length === 0 && (
                <Box sx={{ color: 'warning.dark' }}>No arguments available</Box>
            )}
        </Box>
    );
};

export default DynamicForm;
