import { droppedEntries, filesUnder, withPaths } from './files';

const fileEntry = (path: string, file = new File(['x'], path.split('/').pop()!)) =>
    ({
        isFile: true,
        isDirectory: false,
        fullPath: path,
        file: (resolve: (file: File) => void) => resolve(file),
    }) as unknown as FileSystemEntry;

/** A directory whose children come out of ``readEntries`` in the given batches, then run dry. */
const dirEntry = (path: string, batches: FileSystemEntry[][]) => {
    const queue = [...batches];
    return {
        isFile: false,
        isDirectory: true,
        fullPath: path,
        createReader: () => ({
            readEntries: (resolve: (entries: FileSystemEntry[]) => void) => resolve(queue.shift() ?? []),
        }),
    } as unknown as FileSystemEntry;
};

describe('withPaths', () => {
    test('uses the relative path a folder choice gives, else the file name', () => {
        const inFolder = new File(['x'], 'zstat1.nii.gz');
        Object.defineProperty(inFolder, 'webkitRelativePath', { value: 'cope1.feat/stats/zstat1.nii.gz' });
        const loose = new File(['x'], 'map.nii');
        expect(withPaths([inFolder, loose]).map((item) => item.path)).toEqual([
            'cope1.feat/stats/zstat1.nii.gz',
            'map.nii',
        ]);
    });
});

describe('droppedEntries', () => {
    test('keeps the entries it can read and skips items that give none', () => {
        const entry = fileEntry('/a.nii');
        const items = [{ webkitGetAsEntry: () => entry }, { webkitGetAsEntry: () => null }, {}];
        expect(droppedEntries(items as unknown as DataTransferItemList)).toEqual([entry]);
    });
});

describe('filesUnder', () => {
    test('gives a dropped file its name without the leading slash', async () => {
        const found = await filesUnder(fileEntry('/a.nii'));
        expect(found.map((item) => item.path)).toEqual(['a.nii']);
    });

    test('walks nested folders, keeping the dropped folder first in each path', async () => {
        const tree = dirEntry('/cope1.feat', [
            [fileEntry('/cope1.feat/a.nii'), dirEntry('/cope1.feat/stats', [[fileEntry('/cope1.feat/stats/z.nii')]])],
        ]);
        const found = await filesUnder(tree);
        expect(found.map((item) => item.path).sort()).toEqual(['cope1.feat/a.nii', 'cope1.feat/stats/z.nii']);
    });

    test('reads every batch of a folder, not just the first hundred', async () => {
        const batch = (from: number, count: number) =>
            Array.from({ length: count }, (_, i) => fileEntry(`/big/${from + i}.nii`));
        const found = await filesUnder(dirEntry('/big', [batch(0, 100), batch(100, 100), batch(200, 5)]));
        expect(found).toHaveLength(205);
    });

    test('returns nothing for an empty folder', async () => {
        expect(await filesUnder(dirEntry('/empty', []))).toEqual([]);
    });
});
