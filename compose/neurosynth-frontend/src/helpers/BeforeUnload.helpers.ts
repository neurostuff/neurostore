enum EUnloadStatus {
    STUDYSTORE = 'study-store-unsaved-changes',
    PROJECTSTORE = 'project-store-unsaved-changes',
    ANNOTATIONSTORE = 'annotation-store-unsaved-changes',
}

const onUnloadHandler = (event: BeforeUnloadEvent) => {
    return (event.returnValue = 'Are you sure you want to leave?');
};

export const setUnloadHandler = (store: 'project' | 'study' | 'annotation') => {
    if (store === 'project') {
        window.sessionStorage.setItem(EUnloadStatus.PROJECTSTORE, 'true');
    } else if (store === 'study') {
        window.sessionStorage.setItem(EUnloadStatus.STUDYSTORE, 'true');
    } else if (store === 'annotation') {
        window.sessionStorage.setItem(EUnloadStatus.ANNOTATIONSTORE, 'true');
    }
    if (!window.onbeforeunload) window.onbeforeunload = onUnloadHandler;
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
        window.onbeforeunload = null;
    }
};
