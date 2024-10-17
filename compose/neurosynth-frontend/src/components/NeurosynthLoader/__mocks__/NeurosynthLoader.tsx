import { INeurosynthLoader } from '../NeurosynthLoader';

const MockNeurosynthLoader: React.FC<INeurosynthLoader> = (props) => {
    return <div data-testid="neurosynth-loader">{props.children}</div>;
};

export default MockNeurosynthLoader;
