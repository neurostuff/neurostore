export const lastUpdatedAtSortFn = (
    a: { updated_at?: string | null; created_at?: string | null },
    b: { updated_at?: string | null; created_at?: string | null }
): number => {
    const dateAUpdatedAt = Date.parse(a.updated_at || a.created_at || '');
    const dateBUpdatedAt = Date.parse(b.updated_at || b.created_at || '');

    if (isNaN(dateAUpdatedAt) && isNaN(dateBUpdatedAt)) return 0;
    if (isNaN(dateAUpdatedAt)) return -1;
    if (isNaN(dateBUpdatedAt)) return 1;

    // if they both exist and are NOT the same, do comparison
    return dateAUpdatedAt - dateBUpdatedAt;
};

/**
 * Most common hashcode implementations multiply by 31 for mathematical reasons as it is odd, prime, and provides an acceptable distribution with minimal collisions:
 * https://stackoverflow.com/questions/299304/why-does-javas-hashcode-in-string-use-31-as-a-multiplier
 */
export const stringToColor = (stringArg: string) => {
    // first step: create binary hashcode from string
    let hash = 0;
    for (let i = 0; i < stringArg.length; i++) {
        const charCode = stringArg.charCodeAt(i);
        const multiplier = (hash << 5) - hash; // Mathematically, 31 * i === (i << 5) - i
        hash = charCode + multiplier;
    }
    // second step: create hexadecimal string
    // a hexadecimal string describes the RGB value with the first two digits corresponding to R, second two to G, and final two to B.
    let color = '#';
    for (let i = 0; i < 3; i++) {
        const value = (hash >> (i * 8)) & 0xff; // mask the ith 8th binary digits which correspond to a number between 0 and 255
        const hexColor = `00${value.toString(16)}`; // need the '00' to pad in case we don't have enough hexadecimal digits
        color = `${color}${hexColor.substring(hexColor.length - 2)}`;
    }
    return color;
};

export const stringToNumber = (s: string): { value: number; isValid: boolean } => {
    if (s === '')
        return {
            value: 0,
            isValid: false,
        };
    const parsedNum = Number(s);
    if (isNaN(parsedNum)) {
        return {
            value: 0,
            isValid: false,
        };
    }
    return {
        value: parsedNum,
        isValid: true,
    };
};

export const getAuthorsShortName = (authors: string) => {
    let shortName = authors;
    const authorsList = (authors || '').split(',');
    if (authorsList.length > 1) {
        shortName = `${authorsList[0]}., et al.`;
    }
    return shortName;
};
