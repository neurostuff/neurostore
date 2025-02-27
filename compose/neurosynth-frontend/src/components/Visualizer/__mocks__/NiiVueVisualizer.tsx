const MockNiiVueVisualizer: React.FC<{ imageURL: string }> = ({ imageURL }) => {
    return (
        <div>
            <h1>Mocked NiiVue Visualizer</h1>
            <span data-testid="imageURL">{imageURL}</span>
        </div>
    );
};

export default MockNiiVueVisualizer;
