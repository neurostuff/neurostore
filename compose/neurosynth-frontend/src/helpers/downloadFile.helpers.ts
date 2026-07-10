const formatCSVRow = (values: unknown[]): string =>
    values
        .map(String)
        .map((value) => value.replaceAll('"', '""'))
        .map((value) => `"${value}"`)
        .join(',');

export const toCSV = (headers: string[], data: Record<string, unknown>[]): string => {
    const headerRow = formatCSVRow(headers);
    const dataRows = data.map((row) => formatCSVRow(headers.map((header) => row[header] ?? '')));
    return [headerRow, ...dataRows].join('\r\n');
};

export const downloadFile = (filename: string, fileContents: BlobPart, contentType: string) => {
    const blob = new Blob([fileContents], { type: contentType });
    const element = window.document.createElement('a');
    element.href = window.URL.createObjectURL(blob);
    element.download = filename;
    window.document.body.appendChild(element);
    element.click();
    window.document.body.removeChild(element);
};
