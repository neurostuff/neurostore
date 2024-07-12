export const lastUpdatedAtSortFn = (
    a: { updated_at?: string | null; created_at?: string | null },
    b: { updated_at?: string | null; created_at?: string | null }
): number => {
    const dateAUpdatedAt = Date.parse(a.updated_at || '');
    const dateBUpdatedAt = Date.parse(b.updated_at || '');

    if (isNaN(dateAUpdatedAt) && dateBUpdatedAt) {
        // if update_at A does not exist, automatically treat A as smaller
        return -1;
    } else if (isNaN(dateBUpdatedAt) && dateAUpdatedAt) {
        // if update_at B does not exist, automatically treat B as smaller
        return 1;
    } else if (dateAUpdatedAt && dateBUpdatedAt) {
        // if they both exist and are NOT the same, do comparison
        return dateAUpdatedAt - dateBUpdatedAt;
    } else {
        // if they do not exist, compare created_at instead
        const dateA = Date.parse(a.created_at || ''); // Date.parse('') will yield NaN
        const dateB = Date.parse(b.created_at || ''); // Date.parse('') will yield NaN
        if (isNaN(dateA) || isNaN(dateB)) return 0;
        return dateA - dateB;
    }
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
