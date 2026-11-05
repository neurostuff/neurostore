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

/** Registered by the coordinates table while an analysis is selected. Save and analysis switching read the grid from here. */
export type PointsTableHandle = {
    flushPoints: () => void;
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
    pointsTableRef: React.RefObject<PointsTableHandle | null>;
    /** Bumped after a study save so the open coordinates table seeds again from the reloaded store. */
    pointsTableSeed: number;
    annotationHasEdits: boolean;
    setAnnotationHasEdits: (hasEdits: boolean) => void;
    saveStudy: ReturnType<typeof useSaveStudy>;
}

const StudyCBMAContext = createContext<IStudyCBMAContext | undefined>(undefined);

export const StudyCBMAProvider = ({ children }: { children: React.ReactNode }) => {
    const studyAnnotationsTableRef = useRef<StudyAnnotationsTableHandle | null>(null);
    const pointsTableRef = useRef<PointsTableHandle | null>(null);
    const [pointsTableSeed, setPointsTableSeed] = useState(0);
    const [annotationHasEdits, setAnnotationHasEditsState] = useState(false);
    const bumpPointsTableSeed = useCallback(() => {
        setPointsTableSeed((seed) => seed + 1);
    }, []);

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
        pointsTableRef,
        annotationHasEdits,
        setAnnotationHasEdits,
        bumpPointsTableSeed
    );

    const contextValue = useMemo(
        () => ({
            studyAnnotationsTableRef,
            pointsTableRef,
            pointsTableSeed,
            annotationHasEdits,
            setAnnotationHasEdits,
            saveStudy: { isLoading, hasEdits, handleSave },
        }),
        [annotationHasEdits, setAnnotationHasEdits, pointsTableSeed, isLoading, hasEdits, handleSave]
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
