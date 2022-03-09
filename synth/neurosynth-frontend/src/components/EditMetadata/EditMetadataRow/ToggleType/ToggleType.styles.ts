import { Style } from '../../../..';

const ToggleTypeStyles: Style = {
    type_string: {
        color: 'orange !important',
        '& fieldset': {
            borderColor: 'orange !important',
        },
        '&.Mui-focused fieldset': {
            borderColor: 'orange !important',
        },
    },
    type_number: {
        color: 'blue !important',
        '& fieldset': {
            borderColor: 'blue !important',
        },
        '&.Mui-focused fieldset': {
            borderColor: 'blue !important',
        },
    },
    type_boolean: {
        color: 'green !important',
        '& fieldset': {
            borderColor: 'green !important',
        },
        '&.Mui-focused fieldset': {
            borderColor: 'green !important',
        },
    },
    type_none: {
        color: '#b5b5b5 !important',
        '& fieldset': {
            borderColor: '#b5b5b5 !important',
        },
        '&.Mui-focused fieldset': {
            borderColor: '#b5b5b5 !important',
        },
    },
    toggle_item: {
        minWidth: '118px',
        '& .MuiOutlinedInput-input': {
            padding: '7px 14px !important',
        },
    },
    toggleItemContainer: {
        height: '100%',
        display: 'table-cell',
        verticalAlign: 'middle',
    },
};

export default ToggleTypeStyles;
