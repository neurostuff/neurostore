import { Box } from '@mui/material';
import { Handle, Position } from 'reactflow';

const NeurosynthNode: React.FC<{
    data: { label?: string; bottomHandleId: string; rightHandleId: string; topHandleId: string };
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
                    height: '100%',
                    padding: '10px',
                    fontSize: '12px',
                    whiteSpace: 'pre-line',
                }}
            >
                {props?.data?.label || ''}
            </Box>
            <Handle type="source" id={props.data.bottomHandleId} position={Position.Bottom} />
            <Handle type="source" id={props.data.rightHandleId} position={Position.Right} />
        </>
    );
};

export default NeurosynthNode;
