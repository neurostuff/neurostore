/** Reading what the author chose or dropped: a folder's files with the paths they sit at. */

/** A folder's files with their paths inside it, from an <input webkitdirectory>. */
export const withPaths = (files: FileList | File[]) =>
    Array.from(files).map((file) => ({ file, path: file.webkitRelativePath || file.name }));

/** What was dropped on the page, taken synchronously: the list empties after an await. */
export const droppedEntries = (items: DataTransferItemList) =>
    Array.from(items)
        .map((item) => item.webkitGetAsEntry?.() ?? null)
        .filter((entry): entry is FileSystemEntry => entry !== null);

/** Every file under a dropped file or folder, with its path as <input webkitdirectory>
 * would give it: the dropped folder's name first, no leading slash. */
export async function filesUnder(entry: FileSystemEntry): Promise<{ file: File; path: string }[]> {
    if (entry.isFile) {
        const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
        return [{ file, path: entry.fullPath.replace(/^\//, '') }];
    }
    if (!entry.isDirectory) return [];
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const children: FileSystemEntry[] = [];
    // readEntries hands out at most 100 entries at a time; read until it runs dry.
    for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
        if (batch.length === 0) break;
        children.push(...batch);
    }
    return (await Promise.all(children.map(filesUnder))).flat();
}
