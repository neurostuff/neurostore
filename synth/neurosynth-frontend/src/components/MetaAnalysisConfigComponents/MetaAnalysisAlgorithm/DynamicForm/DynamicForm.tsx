import { Box } from '@mui/material';
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

    const getFormComponentBySpec = (spec: IParameter) => {};

    return (
        <Box>
            <DynamicFormKwargInput {...parametersList[0]} />
            <DynamicFormNumericInput {...parametersList[1]} />
            <DynamicFormSelectInput {...parametersList[2]} />
            <DynamicFormStringInput {...parametersList[2]} />
            {/* {
            specificationList.map(spec => (

            ))
        } */}
        </Box>
    );
};

export default DynamicForm;
