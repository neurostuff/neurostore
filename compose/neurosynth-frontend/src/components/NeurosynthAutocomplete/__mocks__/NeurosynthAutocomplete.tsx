interface IMockNeurosynthAutocomplete {
    required?: boolean;
    label: string;
    shouldDisable?: boolean;
    isOptionEqualToValue: any;
    renderOption?: any;
    value: any;
    getOptionLabel: any;
    onChange: any;
    options: any[];
    sx?: any;
    isLoading?: boolean;
    isError?: boolean;
}

const mockNeurosynthAutocomplete = (props: IMockNeurosynthAutocomplete) => {
    const onOptionSelect = (option: any) => {
        props.onChange(null, option, null);
    };

    return (
        <div data-testid={props.label}>
            {props.options.map((option, index) => (
                <button key={index} onClick={() => onOptionSelect(option)}>
                    {props.getOptionLabel(option)}
                </button>
            ))}
        </div>
    );
};

export default mockNeurosynthAutocomplete;
