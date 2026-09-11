import { Box, Button, Divider } from '@mui/material';
import { useState } from 'react';
import { IDynamicFormInput } from 'pages/MetaAnalysis/components/DynamicForm.types';
import DynamicFormKwargInput from 'pages/MetaAnalysis/components/DynamicFormKwargInput';
import DynamicFormStyles from 'pages/MetaAnalysis/components/DynamicFormStyles';

const DynamicFormKwargToggleVisibility = (props: IDynamicFormInput) => {
    const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

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
                <DynamicFormKwargInput {...props} />
            </Box>
        </Box>
    );
};

export default DynamicFormKwargToggleVisibility;
