const MockDisplayParsedNiMareFile = ({  nimareFileName  }: { nimareFileName: string | undefined }) => {
    return <div data-testid="test-display-parsed-nimare-file">{nimareFileName}</div>;
};

export default MockDisplayParsedNiMareFile;
