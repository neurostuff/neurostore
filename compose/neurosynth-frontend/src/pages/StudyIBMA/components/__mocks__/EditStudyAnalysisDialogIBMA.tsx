import type { AnalysisBoardRow } from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.types';
import type { EditStudyAnalysisSavePayload } from 'pages/StudyIBMA/components/EditStudyAnalysisDialogIBMA';

const MockEditStudyAnalysisDialogIBMA: React.FC<{
    analysis: AnalysisBoardRow | null;
    onClose: () => void;
    onEditAnalysis: (payload: EditStudyAnalysisSavePayload) => void;
}> = ({ analysis, onClose, onEditAnalysis }) =>
    analysis ? (
        <div data-testid="edit-analysis-dialog">
            <button
                type="button"
                onClick={() =>
                    onEditAnalysis({ analysisId: analysis.id!, name: 'Saved', description: '' })
                }
            >
                dialog-save
            </button>
            <button type="button" onClick={onClose}>
                dialog-close
            </button>
        </div>
    ) : null;

export default MockEditStudyAnalysisDialogIBMA;
