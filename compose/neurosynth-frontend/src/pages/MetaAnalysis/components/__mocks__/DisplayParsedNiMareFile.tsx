const MockDisplayParsedNiMareFile: React.FC<{ nimareFileName: string | undefined }> = ({ nimareFileName }) => {
    return <div data-testid="test-display-parsed-nimare-file">{nimareFileName}</div>;
};

export default MockDisplayParsedNiMareFile;
