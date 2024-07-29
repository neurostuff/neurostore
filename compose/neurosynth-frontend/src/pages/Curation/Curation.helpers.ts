export const downloadFile = (filename: string, fileContents: BlobPart, contentType: string) => {
    const blob = new Blob([fileContents], { type: contentType });
    const element = window.document.createElement('a');
    element.href = window.URL.createObjectURL(blob);
    element.download = filename;
    window.document.body.appendChild(element);
    element.click();
    window.document.body.removeChild(element);
};
