import { VisualizerModel } from '../Visualizer';

const MockVisualizer: React.FC<VisualizerModel> = (props) => {
    return (
        <div>
            <h1>Mocked Visualizer</h1>
            <span data-testid="imageURL">{props.imageURL}</span>
            <span data-testid="fileName">{props.fileName}</span>
            <span data-testid="index">{props.index}</span>
            <span data-testid="template">{props.template}</span>
            <span data-testid="styling">{JSON.stringify(props.styling)}</span>
        </div>
    );
};

export default MockVisualizer;
