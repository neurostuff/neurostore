import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import ProgressLoader from 'components/ProgressLoader';

export interface INeurosynthLoader {
    loaded: boolean;
    loadingText?: string;
    children?: React.ReactNode;
}

const NeurosynthLoader = (props: INeurosynthLoader) => {
    return (
        <>
            {props.loaded ? (
                <>{props.children}</>
            ) : (
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        margin: '0.5rem',
                    }}
                >
                    <ProgressLoader disableShrink={false} />
                    {props.loadingText && <Box sx={{ margin: '0.5rem' }}> {props.loadingText} </Box>}
                </Box>
            )}
        </>
    );
};

export default NeurosynthLoader;
