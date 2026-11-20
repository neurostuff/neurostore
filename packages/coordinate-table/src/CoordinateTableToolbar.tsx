import Add from "@mui/icons-material/Add";
import Delete from "@mui/icons-material/Delete";
import TableRows from "@mui/icons-material/TableRows";
import { Button, ButtonGroup, Tooltip } from "@mui/material";
import { memo } from "react";

/** The grid's row actions: add a row, add several, delete the selected rows. */
export const CoordinateTableToolbar = memo(function CoordinateTableToolbar({
  onAddRow,
  onAddRows,
  onDeleteRows,
  disabled = false,
}: {
  onAddRow: () => void;
  onAddRows: () => void;
  onDeleteRows: () => void;
  disabled?: boolean;
}) {
  return (
    <ButtonGroup
      orientation="vertical"
      sx={{ width: "40px" }}
      disabled={disabled}
    >
      <Tooltip title="Add row" placement="right">
        <Button
          aria-label="Add row"
          onClick={onAddRow}
          color="primary"
          sx={{ height: "40px" }}
        >
          <Add fontSize="small" />
        </Button>
      </Tooltip>
      <Tooltip title="Add rows" placement="right">
        <Button
          aria-label="Add rows"
          onClick={onAddRows}
          color="primary"
          sx={{ height: "40px" }}
        >
          <Add sx={{ fontSize: "18px" }} />
          <TableRows sx={{ fontSize: "12px" }} />
        </Button>
      </Tooltip>
      <Tooltip title="Delete row(s)" placement="right">
        <Button
          aria-label="Delete row(s)"
          onClick={onDeleteRows}
          color="error"
          sx={{ height: "40px" }}
        >
          <Delete sx={{ fontSize: "20px" }} />
        </Button>
      </Tooltip>
    </ButtonGroup>
  );
});
