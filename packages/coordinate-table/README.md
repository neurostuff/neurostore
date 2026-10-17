# @neurosynth/coordinate-table

The coordinate points grid of Neurosynth Compose's CBMA editor, as a component: Handsontable 18 under MUI v5,
with compose's columns, validation, paste cleaning and row toolbar. `/review` (store/review-frontend) uses it;
compose is to switch to it.

```tsx
import { CoordinateTable, rowsDiff } from '@neurosynth/coordinate-table';
```

`CoordinateTable` takes the rows (`points`) and calls `onChange` once for each committed change (a cell edit, a
paste, a fill, a row added or deleted) with every row after it, and only when every cell is valid. Invalid cells
are marked, and a status line says how many there are.

`StaticTable` (`@neurosynth/coordinate-table/static`, which loads no Handsontable) shows the same rows as a
read-only table of the grid's widths and row heights, and hands `onEngage` whatever begins an edit there; the
grid's `ref` carries it on with `engage`, so an app can mount the grid only when a reviewer starts to edit.

## Compose's points table on the package

Compose's `EditStudyAnalysisCBMAPointsHotTable` keeps points in its store through per-row hooks:
`useCreateAnalysisPoints`, `useDeleteAnalysisPoints` and `useUpdateAnalysisPoints`. On the package it would map
each change to them with `rowsDiff`, which compares the rows before and after by row id:

```tsx
<CoordinateTable
    points={points}
    label="analysis points"
    minRows={1}
    stretchH="all"
    onChange={(next) => {
        const { created, deleted } = rowsDiff(points, next);
        if (deleted.length) deletePoints(analysisId, deleted.map((point) => point.id));
        if (created.length) createPoint(analysisId, created, next.indexOf(created[0]));
        updatePoints(analysisId, next);
    }}
/>
```

- `minRows={1}` keeps the last row, as compose's `beforeRemoveRow` does.
- `stretchH="all"` stretches the columns across the table, as compose's does; `CBMA_COLUMNS` keeps compose's
  widths (30 px for x, y and z), which only read as intended when stretched. `/review` gives its columns fixed
  widths (58 px for a number) and does not stretch, since its inspector is narrow and its extra columns scroll.
- The grid validates every cell again after a fill, as compose's `afterAutofill` does.
- Undo is off in the grid (`DEFAULT_SETTINGS.undo`); the app owns it.
- The size compose's `useEditAnalysisPointsHotTable` works out is `autoRows` and `maxHeight` here: the grid grows
  to `autoRows` rows, then is `maxHeight` high and scrolls.
- One difference: compose adds an empty row to its store when the row is added; here an added row is part of a
  change only once its required cells (x, y and z) are filled.

## Tests

Handsontable does not lay out in jsdom. `@neurosynth/coordinate-table/testing` is a stand-in a test file mocks
`@handsontable/react-wrapper` with: it edits rows in place and runs the hooks the grid uses, as Handsontable does.
`store/review-frontend/e2e` checks the same hooks against the real grid in a browser.
