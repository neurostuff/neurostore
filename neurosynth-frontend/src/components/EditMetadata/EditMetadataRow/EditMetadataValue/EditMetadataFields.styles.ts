import { Style } from '../../../..';

const EditMetadataFieldsStyles: Style = {
    checkedTrue: {
        color: 'primary.main',
    },
    checkedFalse: {
        color: 'secondary.main',
    },
    textfield: {
        width: '100%',
        '& .MuiOutlinedInput-root': {
            padding: '10px 14px !important',
            fontSize: '12px !important',
        },
    },
    numberfield: {
        width: '100%',
        '& .MuiOutlinedInput-input': {
            padding: '10px 14px !important',
            fontSize: '12px !important',
        },
    },
};

export default EditMetadataFieldsStyles;
