import { Box } from '@mui/material';
import { Style } from 'index';
import { Handle, Position } from 'reactflow';

export interface INeurosynthNodeData {
    label?: string;
    bottomHandleId?: string;
    rightHandleId?: string;
    leftHandleId?: string;
    topHandleId?: string;
    sx?: Style;
}

const NeurosynthNode: React.FC<{
    data: INeurosynthNodeData;
}> = (props) => {
    return (
        <>
            <Handle type="target" id={props.data.topHandleId} position={Position.Top} />
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'start',
                    textAlign: 'start',
                    fontSize: '12px',
                    height: '100%',
                    fontWeight: 'bold',
                    whiteSpace: 'pre-line',
                    zIndex: 99,
                    backgroundColor: 'white',
                    border: '1px solid black',
                    borderRadius: '4px',
                    ...(props?.data?.sx || {}),
                }}
            >
                <Box component="span" sx={{ padding: '10px' }}>
                    {props?.data?.label || ''}
                </Box>
            </Box>
            <Handle type="source" id={props.data.bottomHandleId} position={Position.Bottom} />
            <Handle type="target" id={props.data.leftHandleId} position={Position.Left} />
            <Handle type="source" id={props.data.rightHandleId} position={Position.Right} />
        </>
    );
};

export default NeurosynthNode;
