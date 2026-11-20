const MINUS_LOOKALIKES = /֊|‐|‑|⁃|﹣|－|‒|–|—|﹘|−|-/g;

/** `value` with every minus-sign lookalike as `-`. */
export const replaceMinus = (value: unknown) =>
  typeof value === "string" ? value.replace(MINUS_LOOKALIKES, "-") : value;

/** The text of `html`, its tags dropped. */
export const stripTags = (html: unknown) =>
  typeof html === "string"
    ? (new DOMParser().parseFromString(html, "text/html").body.textContent ??
      "")
    : "";

/** Cleans pasted cells in place: markup copied from a web page goes, minus lookalikes become `-`, and true and false are booleans. */
export function sanitizePaste(data: unknown[][]) {
  data.forEach((row, at) => {
    row.forEach((value, column) => {
      if (typeof value === "number" || typeof value === "boolean") return;
      const text = replaceMinus(stripTags(value));
      data[at][column] =
        text === "true" ? true : text === "false" ? false : text;
    });
  });
}
