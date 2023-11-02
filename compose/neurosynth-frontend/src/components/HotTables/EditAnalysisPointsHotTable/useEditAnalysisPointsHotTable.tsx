import HotTable from '@handsontable/react';
import { useStudyAnalysisPoints } from 'pages/Studies/StudyStore';
import { IStorePoint } from 'pages/Studies/StudyStore.helpers';
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
    };

    const openInsertRowsDialog = () => {
        setInsertRowsDialogIsOpen(true);
    };

    // run every time points are updated to validate (in charge of highlighting the cells that are invalid)
    useEffect(() => {
        hotTableRef.current?.hotInstance?.validateCells();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [points]);

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
        const totalHeight = 28 + (points?.length || 0) * 23;
        const height = totalHeight > 500 ? 500 : totalHeight;
        return height;
    }, [points]);

    return {
        height,
        insertRowsDialogIsOpen,
        closeInsertRowsDialog,
    };
};

export default useAnalysisPointsHotTable;
