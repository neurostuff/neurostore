import { NoteKeyType } from 'components/HotTables/HotTables.types';
import { setUnloadHandler, unsetUnloadHandler } from 'helpers/BeforeUnload.helpers';
import { EditStudyAnnotationsNoteCollectionReturn } from 'pages/StudyCBMA/components/EditStudyAnnotationsHotTable.types';
import useSaveStudy from 'pages/StudyCBMA/hooks/useSaveStudy';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

export type StudyAnnotationEdits = {
    noteKeys: NoteKeyType[];
    rows: EditStudyAnnotationsNoteCollectionReturn[];
    editedRowIndexes: Set<number>;
    noteKeysHaveChanged: boolean;
};

/** Registered by the study annotations table while it is mounted. The table holds the draft annotation until Save. */
export type StudyAnnotationsTableHandle = {
    getAnnotationEdits: () => StudyAnnotationEdits | undefined;
    /** Clears the edited rows and the note-key flag, and swaps temporary analysis ids for the saved ones. */
    markSaved: (analysisIdByTemporaryId?: Map<string, string>) => void;
    insertAnalysisRow: (analysisId: string, studyId: string, analysisName: string) => void;
    removeAnalysisRow: (analysisId: string) => void;
    updateAnalysisDetails: (analysisId: string, field: 'name' | 'description', value: string) => void;
};

interface IStudyCBMAContext {
    studyAnnotationsTableRef: React.RefObject<StudyAnnotationsTableHandle | null>;
    annotationHasEdits: boolean;
    setAnnotationHasEdits: (hasEdits: boolean) => void;
    saveStudy: ReturnType<typeof useSaveStudy>;
}

const StudyCBMAContext = createContext<IStudyCBMAContext | undefined>(undefined);

export const StudyCBMAProvider = ({ children }: { children: React.ReactNode }) => {
    const studyAnnotationsTableRef = useRef<StudyAnnotationsTableHandle | null>(null);
    const [annotationHasEdits, setAnnotationHasEditsState] = useState(false);

    // hasUnsavedStudyChanges reads the unload handler, so it has to follow this flag
    const setAnnotationHasEdits = useCallback((hasEdits: boolean) => {
        if (hasEdits) {
            setUnloadHandler('annotation');
        } else {
            unsetUnloadHandler('annotation');
        }
        setAnnotationHasEditsState(hasEdits);
    }, []);

    // called once here so the toolbar and the Complete button share one save and one loading state
    const { isLoading, hasEdits, handleSave } = useSaveStudy(
        studyAnnotationsTableRef,
        annotationHasEdits,
        setAnnotationHasEdits
    );

    const contextValue = useMemo(
        () => ({
            studyAnnotationsTableRef,
            annotationHasEdits,
            setAnnotationHasEdits,
            saveStudy: { isLoading, hasEdits, handleSave },
        }),
        [annotationHasEdits, setAnnotationHasEdits, isLoading, hasEdits, handleSave]
    );

    return <StudyCBMAContext.Provider value={contextValue}>{children}</StudyCBMAContext.Provider>;
};

export const useStudyCBMAContext = () => {
    const context = useContext(StudyCBMAContext);
    if (!context) {
        throw new Error('useStudyCBMAContext must be used within StudyCBMAProvider');
    }
    return context;
};
