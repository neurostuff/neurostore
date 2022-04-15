import { Box, Divider } from '@mui/material';
import DynamicFormKwargInput from './DynamicFormKwargInput';
import DynamicFormNumericInput from './DynamicFormNumericInput';
import DynamicFormSelectInput from './DynamicFormSelectInput';
import DynamicFormStringInput from './DynamicFormStringInput';

interface IDynamicForm {
    specification: {
        [key: string]: IParameter;
    };
}

export interface IParameter {
    description: string;
    type: any;
    default: string | number | null;
}

export interface IDynamicFormInput {
    parameterName: string;
    value: IParameter;
}

const kwargString = '**kwargs';

const DynamicForm: React.FC<IDynamicForm> = (props) => {
    const parametersList: IDynamicFormInput[] = Object.keys(props.specification).map(
        (parameter) => ({
            parameterName: parameter,
            value: props.specification[parameter],
        })
    );

    const getFormComponentBySpec = (spec: IParameter): React.FC<IDynamicFormInput> => {
        switch (spec.type) {
            case 'str':
                return DynamicFormStringInput;
            case 'int':
            case 'float':
                return DynamicFormNumericInput;
            case null:
                return DynamicFormKwargInput;
            default:
                return DynamicFormSelectInput;
        }
    };

    return (
        <Box>
            {parametersList.map((parameter) => {
                const Component = getFormComponentBySpec(parameter.value);
                return (
                    <Box key={parameter.parameterName}>
                        <Component {...parameter} />
                    </Box>
                );
            })}
        </Box>
    );
};

export default DynamicForm;
