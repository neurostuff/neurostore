import type { ReactNode } from 'react';
import { INeurosynthLoader } from '../NeurosynthLoader';

const MockNeurosynthLoader = (props: INeurosynthLoader) => {
    return <div data-testid="neurosynth-loader">{props.children}</div>;
};

export default MockNeurosynthLoader;
