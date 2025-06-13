import { Box, LinkProps, Tooltip, Typography } from '@mui/material';
import TextEdit, { ITextEdit } from 'components/TextEdit/TextEdit';
import DisplayLink from './DisplayLink';

const EditableDisplayLink: React.FC<{
    linkProps: LinkProps;
    label: string;
    textEditProps: ITextEdit;
    noLabelText: string;
    stubId: string; // for resetting the textEdit component
    tooltip?: string;
}> = ({ linkProps, label, noLabelText = '', textEditProps, stubId, tooltip }) => {
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', marginRight: '0.5rem' }}>
            <TextEdit
                key={stubId}
                {...textEditProps}
                textFieldSx={{
                    input: {
                        padding: 0,
                        fontSize: '12px',
                    },
                    label: {
                        fontSize: '12px',
                        lineHeight: '13px',
                    },
                    maxWidth: '200px !important',
                    minWidth: '200px !important',
                    width: '200px !important',
                    ...textEditProps.textFieldSx,
                }}
            >
                {textEditProps.textToEdit ? (
                    <Tooltip title={tooltip} placement="top">
                        <>
                            <DisplayLink label={label} {...linkProps} />
                        </>
                    </Tooltip>
                ) : (
                    <Typography sx={{ color: textEditProps.textToEdit ? 'initial' : 'warning.dark' }} variant="body2">
                        {noLabelText}
                    </Typography>
                )}
            </TextEdit>
        </Box>
    );
};

export default EditableDisplayLink;
