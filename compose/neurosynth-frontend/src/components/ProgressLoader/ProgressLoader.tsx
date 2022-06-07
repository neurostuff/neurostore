import { CircularProgress, CircularProgressProps } from '@mui/material';

const ProgressLoader: React.FC<CircularProgressProps> = (props) => {
    return <CircularProgress {...props} disableShrink />;
};

export default ProgressLoader;
