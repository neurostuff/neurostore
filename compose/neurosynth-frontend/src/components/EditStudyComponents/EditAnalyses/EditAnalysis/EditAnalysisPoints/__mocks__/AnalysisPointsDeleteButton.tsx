const AnalysisPointsDeleteButton: React.FC<{
    pointId: string | undefined;
    onDelete: (id: string) => void;
}> = (props) => {
    return (
        <button
            data-testid="trigger-point-delete"
            onClick={() => props.onDelete(props.pointId || '')}
        >
            delete
        </button>
    );
};

export default AnalysisPointsDeleteButton;
