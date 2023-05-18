import { CircularProgress, CircularProgressProps } from '@mui/material';

const ProgressLoader: React.FC<CircularProgressProps> = (props) => {
    return <CircularProgress disableShrink {...props} />;
};

export default ProgressLoader;
