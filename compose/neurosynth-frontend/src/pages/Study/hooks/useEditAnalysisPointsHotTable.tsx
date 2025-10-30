import HotTable from '@handsontable/react';
import { useStudyAnalysisPoints } from 'pages/Study/store/StudyStore';
import { IStorePoint } from 'pages/Study/store/StudyStore.helpers';
import { useEffect, useMemo, useState } from 'react';

const useAnalysisPointsHotTable = (
    aanlysisId: string | undefined,
    hotTableRef: React.RefObject<HotTable>,
    hotTableMetadata: React.MutableRefObject<{
        insertRowsAbove: boolean;
        insertedRowsViaPaste: any[][];
    }>
) => {
    const points = useStudyAnalysisPoints(aanlysisId) as IStorePoint[] | null;
    const [insertRowsDialogIsOpen, setInsertRowsDialogIsOpen] = useState(false);

    const closeInsertRowsDialog = () => {
        setInsertRowsDialogIsOpen(false);
        hotTableRef.current?.hotInstance?.validateCells();
    };

    const openInsertRowsDialog = () => {
        setInsertRowsDialogIsOpen(true);
        hotTableRef.current?.hotInstance?.validateCells();
    };

    // run every time points are updated to validate (in charge of highlighting the cells that are invalid)
    useEffect(() => {
        hotTableRef.current?.hotInstance?.validateCells();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [points]);

    useEffect(() => {
        hotTableRef.current?.hotInstance?.validateCells();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [insertRowsDialogIsOpen]);

    // run once initially to set the custom context menu
    useEffect(() => {
        if (hotTableRef.current?.hotInstance) {
            hotTableRef.current.hotInstance.updateSettings({
                contextMenu: {
                    items: {
                        row_above: {
                            name: 'Add rows above',
                            callback: (key, options) => {
                                hotTableMetadata.current.insertRowsAbove = true;
                                openInsertRowsDialog();
                            },
                        },
                        row_below: {
                            name: 'Add rows below',
                            callback: (key, options) => {
                                hotTableMetadata.current.insertRowsAbove = false;
                                openInsertRowsDialog();
                            },
                        },
                        remove_row: {
                            name: 'Remove row(s)',
                        },
                        copy: {
                            name: 'Copy',
                        },
                        cut: {
                            name: 'Cut',
                        },
                    },
                },
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hotTableRef]);

    const height = useMemo(() => {
        const totalHeight = 26 + (points?.length || 0) * 24;
        const height = totalHeight > 600 ? 600 : totalHeight;
        return height;
    }, [points]);

    return {
        height,
        insertRowsDialogIsOpen,
        openInsertRowsDialog,
        closeInsertRowsDialog,
    };
};

export default useAnalysisPointsHotTable;
