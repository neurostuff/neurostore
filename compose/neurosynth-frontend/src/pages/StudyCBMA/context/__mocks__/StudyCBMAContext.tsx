import { vi } from 'vitest';

const useStudyCBMAContext = vi.fn().mockReturnValue({
    studyAnnotationsTableRef: { current: null },
    annotationHasEdits: false,
    setAnnotationHasEdits: vi.fn(),
    saveStudy: {
        isLoading: false,
        hasEdits: false,
        handleSave: vi.fn(),
    },
});

const StudyCBMAProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;

export { useStudyCBMAContext, StudyCBMAProvider };
