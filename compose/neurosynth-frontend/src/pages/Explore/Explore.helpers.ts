/**
 * Deterministic pastel-safe HSL color from text, with contrasting label color
 * for filled chips.
 */
export const textToReadableColor = (text: string): { backgroundColor: string; color: string } => {
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
        hash = text.charCodeAt(index) + ((hash << 5) - hash);
    }

    const hue = Math.abs(hash) % 360;
    // Mid saturation + mid lightness keeps chips distinct without washing out text.
    const saturation = 52 + (Math.abs(hash) % 18);
    const lightness = 42 + (Math.abs(hash >> 8) % 12);
    const backgroundColor = `hsl(${hue} ${saturation}% ${lightness}%)`;
    // Lightness 42–53% → white text reads better on these fills.
    const color = '#ffffff';

    return { backgroundColor, color };
};

export const getExploreChipSx = (text: string, filled: boolean) => {
    const { backgroundColor, color } = textToReadableColor(text);

    if (filled) {
        return {
            backgroundColor,
            color,
            borderColor: backgroundColor,
            '& .MuiChip-deleteIcon': {
                color,
                opacity: 0.9,
                '&:hover': { opacity: 1, color },
            },
        };
    }

    return {
        backgroundColor: 'transparent',
        color: backgroundColor,
        borderColor: backgroundColor,
    };
};
