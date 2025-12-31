import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Table as MuiTable,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  Checkbox,
  Button
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import { visuallyHidden } from "@mui/utils";
import { useNavigate } from "react-router-dom";

export default function Table({ data, title = "Data Table", fromHistory = false }) {

  const navigate = useNavigate();

  // ✅ STABLE ROW ID (change field if needed)
  const getRowId = (row) => row.trade_id; // MUST be unique

  const [order, setOrder] = useState("asc");
  const [orderBy, setOrderBy] = useState(Object.keys(data?.[0] || {})[0] || "");
  const [selected, setSelected] = useState([]); // stores rowIds
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const headCells = data?.[0]
    ? Object.keys(data[0]).map((key) => ({
      id: key,
      numeric: typeof data[0][key] === "number",
      label: key.replace(/_/g, " ").toUpperCase(),
    }))
    : [];

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const handleSelectAllClick = (e) => {
    const allIds = data.map(getRowId);

    console.log("Select ALL clicked:", e.target.checked);
    console.log("All row IDs:", allIds);

    setSelected(e.target.checked ? allIds : []);
  };

  const handleClick = (row) => {
    const id = getRowId(row);

    setSelected((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];

      console.log("Row clicked ID:", id);
      console.log("Previous selected:", prev);
      console.log("Next selected:", next);

      return next;
    });
  };


  const handleContinueToDashboard = () => {
    const selectedRows = data.filter((row) =>
      selected.includes(getRowId(row))
    );

    const tradesBySymbol = selectedRows.reduce((acc, row) => {
      if (!acc[row.symbol]) acc[row.symbol] = [];
      acc[row.symbol].push(row);
      return acc;
    }, {});

    navigate("/temp", { state: { tradesBySymbol, fromHistory } });

  };

  const comparator = (a, b) => {
    const x = a[orderBy] ?? "";
    const y = b[orderBy] ?? "";
    if (x < y) return order === "asc" ? -1 : 1;
    if (x > y) return order === "asc" ? 1 : -1;
    return 0;
  };

  const visibleRows = data
    ?.slice()
    .sort(comparator)
    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  // auto select all initially
  useEffect(() => {
    if (data?.length) setSelected(data.map(getRowId));
  }, [data]);

  return (
    <Box sx={{ width: "100%" }}>
      <Paper sx={{ width: "100%", mb: 2 }}>
        <TableContainer>
          <MuiTable size="small" sx={{ '& td, & th': { py: 0.2 } }}>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" sx={{ width: 48 }}>
                  <Checkbox
                    checked={selected.length === data.length && data.length > 0}
                    indeterminate={
                      selected.length > 0 && selected.length < data.length
                    }
                    onChange={handleSelectAllClick}
                  />
                </TableCell>

                {headCells.map((headCell) => (
                  <TableCell
                    key={headCell.id}
                    sortDirection={orderBy === headCell.id ? order : false}
                  >
                    <TableSortLabel
                      active={orderBy === headCell.id}
                      direction={orderBy === headCell.id ? order : "asc"}
                      onClick={() => handleRequestSort(headCell.id)}
                    >
                      {headCell.label}
                      {orderBy === headCell.id && (
                        <Box component="span" sx={visuallyHidden}>
                          {order === "desc" ? "desc" : "asc"}
                        </Box>
                      )}
                    </TableSortLabel>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {visibleRows.map((row) => {
                const id = getRowId(row);
                const isItemSelected = selected.includes(id);

                return (
                  <TableRow hover key={id} selected={isItemSelected}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={isItemSelected}
                        onChange={() => handleClick(row)}
                      />
                    </TableCell>

                    {headCells.map((cell) => (
                      <TableCell key={cell.id}>
                        {cell.id === "auction"
                          ? row[cell.id]
                            ? "Yes"
                            : "No"
                          : String(row[cell.id])}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </MuiTable>
        </TableContainer>

        <TablePagination
          component="div"
          rowsPerPageOptions={[5, 10, 25]}
          count={data?.length || 0}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />

        <Box display="flex" justifyContent="flex-end" p={1}>
          <Button
            variant="contained"
            color="success"
            endIcon={<SendIcon />}
            onClick={handleContinueToDashboard}
          >
            Continue to Dashboard
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
