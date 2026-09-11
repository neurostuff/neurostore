import { type ComponentType } from 'react';
import { IDynamicFormInput, IParameter } from 'pages/MetaAnalysis/components/DynamicForm.types';
import DynamicFormBoolInput from './DynamicFormBoolInput';
import DynamicFormKwargToggleVisibility from './DynamicFormKwargToggleVisibility';
import DynamicFormNumericInput from './DynamicFormNumericInput';
import DynamicFormSelectInput from './DynamicFormSelectInput';
import DynamicFormStringInput from './DynamicFormStringInput';

export const getDynamicFormInputComponentByParameter = (
    parameter: IParameter,
    kwargInputComponent: ComponentType<IDynamicFormInput> = DynamicFormKwargToggleVisibility
): ComponentType<IDynamicFormInput> => {
    switch (parameter.type) {
        case 'str':
            return DynamicFormStringInput;
        case 'int':
        case 'float':
            return DynamicFormNumericInput;
        case 'bool':
            return DynamicFormBoolInput;
        case null:
            return kwargInputComponent;
        default:
            return DynamicFormSelectInput;
    }
};
