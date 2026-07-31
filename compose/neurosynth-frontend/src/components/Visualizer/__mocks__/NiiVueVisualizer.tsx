const MockNiiVueVisualizer = ({  imageURL  }: { imageURL: string }) => {
    return (
        <div>
            <h1>Mocked NiiVue Visualizer</h1>
            <span data-testid="imageURL">{imageURL}</span>
        </div>
    );
};

export default MockNiiVueVisualizer;
