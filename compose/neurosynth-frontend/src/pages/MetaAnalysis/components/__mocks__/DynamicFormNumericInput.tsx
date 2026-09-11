import type { IDynamicFormInput } from 'pages/MetaAnalysis/components/DynamicForm.types';

const mockDynamicFormNumericInput = (props: IDynamicFormInput) => {
    return (
        <div
            data-testid="dynamic-form-input"
            data-parameter-name={props.parameterName}
            data-disabled={props.disabled ? 'true' : 'false'}
        >
            numeric
        </div>
    );
};

export default mockDynamicFormNumericInput;
