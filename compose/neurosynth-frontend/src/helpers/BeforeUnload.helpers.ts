export enum EUnloadStatus {
    STUDYSTORE = 'study-store-unsaved-changes',
    PROJECTSTORE = 'project-store-unsaved-changes',
    ANNOTATIONSTORE = 'annotation-store-unsaved-changes',
}

let eventListenerSet = false;

const onBeforeUnloadHandler = (event: BeforeUnloadEvent) => {
    event.preventDefault();
    return 'Are you sure you want to leave?';
};

const onUnloadHandler = (event: any) => {
    event.preventDefault();
    window.sessionStorage.removeItem(EUnloadStatus.PROJECTSTORE);
    window.sessionStorage.removeItem(EUnloadStatus.STUDYSTORE);
    window.sessionStorage.removeItem(EUnloadStatus.ANNOTATIONSTORE);
};

export const setUnloadHandler = (store: 'project' | 'study' | 'annotation') => {
    if (store === 'project') {
        window.sessionStorage.setItem(EUnloadStatus.PROJECTSTORE, 'true');
    } else if (store === 'study') {
        window.sessionStorage.setItem(EUnloadStatus.STUDYSTORE, 'true');
    } else if (store === 'annotation') {
        window.sessionStorage.setItem(EUnloadStatus.ANNOTATIONSTORE, 'true');
    }
    if (!eventListenerSet) {
        window.addEventListener('beforeunload', onBeforeUnloadHandler);
        window.addEventListener('unload', onUnloadHandler);
        eventListenerSet = true;
    }
};

export const unsetUnloadHandler = (store: 'project' | 'study' | 'annotation') => {
    if (store === 'project') {
        window.sessionStorage.removeItem(EUnloadStatus.PROJECTSTORE);
    } else if (store === 'study') {
        window.sessionStorage.removeItem(EUnloadStatus.STUDYSTORE);
    } else if (store === 'annotation') {
        window.sessionStorage.removeItem(EUnloadStatus.ANNOTATIONSTORE);
    }

    if (
        window.sessionStorage.getItem(EUnloadStatus.PROJECTSTORE) === null &&
        window.sessionStorage.getItem(EUnloadStatus.STUDYSTORE) === null &&
        window.sessionStorage.getItem(EUnloadStatus.ANNOTATIONSTORE) === null
    ) {
        window.removeEventListener('beforeunload', onBeforeUnloadHandler);
        window.removeEventListener('unload', onUnloadHandler);
        eventListenerSet = false;
    }
};

export const clearUnloadHandlers = () => {
    window.sessionStorage.removeItem(EUnloadStatus.PROJECTSTORE);
    window.sessionStorage.removeItem(EUnloadStatus.STUDYSTORE);
    window.sessionStorage.removeItem(EUnloadStatus.ANNOTATIONSTORE);
    window.removeEventListener('beforeunload', onBeforeUnloadHandler);
    window.removeEventListener('unload', onUnloadHandler);
    eventListenerSet = false;
};

export const hasUnsavedChanges = () => {
    return (
        window.sessionStorage.getItem(EUnloadStatus.PROJECTSTORE) === 'true' ||
        window.sessionStorage.getItem(EUnloadStatus.STUDYSTORE) === 'true' ||
        window.sessionStorage.getItem(EUnloadStatus.ANNOTATIONSTORE) === 'true'
    );
};

export const hasUnsavedStudyChanges = () => {
    return (
        window.sessionStorage.getItem(EUnloadStatus.STUDYSTORE) === 'true' ||
        window.sessionStorage.getItem(EUnloadStatus.ANNOTATIONSTORE) === 'true' // you can edit annotations via study annotations which counts as a study edit
    );
};
