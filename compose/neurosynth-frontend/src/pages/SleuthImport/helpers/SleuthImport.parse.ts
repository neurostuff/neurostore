import { stringToNumber } from 'helpers/utils';

// strip one leading // then trim
export const cleanLine = (line: string) => line.replace(/^\s*\/\/\s*/, '').trim();

export const extractYearFromString = (s: string): { isValid: boolean; value: number } => {
    const match = s.match(/\d{4}/);
    const year = match?.[0];
    if (!year) {
        return { isValid: false, value: 0 };
    }
    return stringToNumber(year);
};

export const extractAuthorsFromString = (s: string): string => {
    const splitStr = s.replaceAll(/[0-9]/g, '');
    return splitStr.trim();
};

export const parseKeyVal = (lineRaw: string): { key: string; value: string } | null => {
    const line = cleanLine(lineRaw).replace(/^\//, ''); // allow optional leading '/'
    const m = line.match(/^([A-Za-z]+)\s*=\s*(.+)$/); // match key=value with whitespace around the equals sign
    if (!m) return null;
    return { key: m[1].toLowerCase(), value: m[2].trim() };
};

export const parseCoordinate = (coordinates: string): { coords: number[]; isValid: boolean } => {
    const parts = coordinates.trim().split(/\s+/); // accept tabs OR spaces
    if (parts.length !== 3) return { coords: [], isValid: false };
    const nums = parts.map((p) => stringToNumber(p));
    if (nums.some((n) => !n.isValid)) return { coords: [], isValid: false };
    return {
        coords: nums.map((n) => n.value),
        isValid: true,
    };
};

export const normalizeLineEndings = (fileContents: string): string => {
    // Normalize Windows and lone carriage returns to Unix/Mac line endings
    return fileContents.replace(/\r\n|\r/g, '\n');
};
