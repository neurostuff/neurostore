import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";
import { useState } from "react";

const DEFAULT_ROWS = 4;

/** Asks how many rows to insert. */
export function InsertRowsDialog({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (rows: number) => void;
}) {
  const [rows, setRows] = useState<number | undefined>(DEFAULT_ROWS);
  const close = () => {
    setRows(DEFAULT_ROWS);
    onClose();
  };
  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="xs">
      <DialogTitle>Enter number of rows to insert</DialogTitle>
      <DialogContent>
        <TextField
          type="number"
          label="number"
          value={rows ?? ""}
          autoFocus
          fullWidth
          sx={{ my: 1 }}
          onChange={(event) => {
            const parsed = parseInt(event.target.value, 10);
            if (event.target.value === "") setRows(undefined);
            else if (!Number.isNaN(parsed)) setRows(parsed);
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button color="error" onClick={close}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!rows || rows < 1}
          onClick={() => {
            if (!rows) return;
            onSubmit(rows);
            setRows(DEFAULT_ROWS);
          }}
        >
          Submit
        </Button>
      </DialogActions>
    </Dialog>
  );
}
