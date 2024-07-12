const MockDynamicForm: React.FC<any> = (props) => {
    const specificationKeys = Object.keys(props.specification);

    return (
        <div>
            {specificationKeys.map((key) => (
                <span key={key}>{key}</span>
            ))}
            <button
                onClick={() => props.onUpdate({ 'test-key': 'test-value' })}
                data-testid="trigger-update"
            >
                trigger update
            </button>
        </div>
    );
};

export default MockDynamicForm;
