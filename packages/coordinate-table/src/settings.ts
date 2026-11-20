import type { HotTableProps } from "@handsontable/react-wrapper";

/** The license compose uses Handsontable under. */
export const LICENSE_KEY = "non-commercial-and-evaluation";

/** Compose's CBMA points table settings, but undo, which the app owns. */
export const DEFAULT_SETTINGS: HotTableProps = {
  themeName: "ht-theme-classic",
  outsideClickDeselects: false,
  licenseKey: LICENSE_KEY,
  selectionMode: "range",
  allowRemoveColumn: false,
  fillHandle: {
    direction: "vertical",
    autoInsertRow: false,
  },
  undo: false,
  wordWrap: false,
  manualColumnResize: false,
  allowInsertColumn: false,
};

/** The context menu's row actions. */
export const CONTEXT_MENU = {
  items: {
    row_above: { name: "Add row above" },
    row_below: { name: "Add row below" },
    remove_row: { name: "Remove row(s)" },
    copy: { name: "Copy" },
    cut: { name: "Cut" },
  },
};
