import { INeurosynthLoader } from '../NeurosynthLoader';

const MockNeurosynthLoader: React.FC<INeurosynthLoader> = (props) => {
    return <div>{props.children}</div>;
};

export default MockNeurosynthLoader;
