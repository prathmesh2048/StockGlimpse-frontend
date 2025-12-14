import React, { useState } from "react";
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
import { useEffect } from "react";
import { visuallyHidden } from "@mui/utils";
import ENV from '../config';
import axios from "axios";
import { useNavigate } from "react-router-dom";


export default function Table({ data, title = "Data Table" }) {

  const navigate = useNavigate();

  const [order, setOrder] = useState("asc");
  const [orderBy, setOrderBy] = useState(Object.keys(data?.[0] || {})[0] || "");
  const [selected, setSelected] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

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
    setSelected(e.target.checked ? data.map((_, idx) => idx) : []);
  };

  const handleClick = (idx) => {
    setSelected((prev) =>
      prev.includes(idx)
        ? prev.filter((sel) => sel !== idx)
        : [...prev, idx]
    );
  };

  const handleContinue = async () => {
    const selectedRows = selected.map(idx => data[idx]);

    console.log("sending:", selectedRows); // verify

    try {
      const res = await axios.post(
        `${ENV.BASE_API_URL}/api/visualize/`,
        selectedRows,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
            "Content-Type": "application/json"
          }
        }
      );

      console.log("saved:", res.data);
      navigate("/temp", { state: res.data });
    } catch (err) {
      console.error(err);
    }
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

  useEffect(() => {
    if (data?.length) setSelected(data.map((_, idx) => idx));
  }, [data]);


  return (
    <Box sx={{ width: "100%" }}>
      <Paper sx={{ width: "100%", mb: 2 }}>
        <br />
        <br />
        <TableContainer>
          <MuiTable size="small">
            <TableHead>
              <TableRow
                sx={{
                  backgroundColor: "#F3F6F9",
                  transition: "background-color 0.3s ease",
                  "&:hover": { backgroundColor: "#EAF2FA" },
                  "& th": {
                    py: 1,
                    px: 1.5,
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    borderBottom: "2px solid #D1D9E6",
                    whiteSpace: "nowrap",
                    letterSpacing: "0.4px",
                    color: "#2C3E50",
                    userSelect: "none",
                  },
                }}
              >
                <TableCell padding="checkbox" sx={{ width: 48 }}>
                  <Checkbox
                    checked={selected.length === data.length && data.length > 0}
                    indeterminate={selected.length > 0 && selected.length < data.length}
                    onChange={handleSelectAllClick}
                    sx={{
                      color: "#1E90FF",
                      borderBottom: "2px solid #d3d6da",
                      "&.Mui-checked": {
                        color: "#1E90FF",
                      },
                      "&:hover": {
                        backgroundColor: "rgba(30, 144, 255, 0.1)",
                      },
                    }}
                    inputProps={{ 'aria-label': 'select all rows' }}
                  />
                </TableCell>
                {headCells.map((headCell) => (
                  <TableCell
                    key={headCell.id}
                    align={headCell.numeric ? "right" : "left"}
                    sortDirection={orderBy === headCell.id ? order : false}
                    sx={{ cursor: "pointer", userSelect: "none" }}
                  >
                    <TableSortLabel
                      active={orderBy === headCell.id}
                      direction={orderBy === headCell.id ? order : "asc"}
                      onClick={() => handleRequestSort(headCell.id)}
                      sx={{
                        fontWeight: 700,
                        color: "#34495E",
                        "& .MuiTableSortLabel-icon": {
                          opacity: orderBy === headCell.id ? 1 : 0.4,
                          transition: "opacity 0.3s ease",
                        },
                        "&:hover": {
                          color: "#1E90FF",
                          "& .MuiTableSortLabel-icon": { opacity: 1 },
                        },
                      }}
                    >
                      {headCell.label}
                      {orderBy === headCell.id && (
                        <Box component="span" sx={visuallyHidden}>
                          {order === "desc" ? "sorted descending" : "sorted ascending"}
                        </Box>
                      )}
                    </TableSortLabel>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleRows?.map((row, i) => {
                const idx = page * rowsPerPage + i;
                const isItemSelected = selected.includes(idx);
                return (
                  <TableRow
                    hover
                    key={idx}
                    selected={isItemSelected}
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        color="primary"
                        checked={isItemSelected}
                        onChange={() => handleClick(idx)}
                        sx={{
                          transform: "scale(0.8)",          // smaller checkbox
                          padding: "0 4px",                 // reduce extra space
                          "&.Mui-checked": {
                            color: "#1E90FF ",               // softer grey-blue instead of pure blue
                          },
                        }}
                      />
                    </TableCell>
                    {headCells.map((cell) => (
                      <TableCell
                        key={cell.id}
                        align={
                          cell.numeric ? "right" : "left"
                        }
                      >
                        {cell.id === "auction" ? (row[cell.id] ? "Yes" : "No") : String(row[cell.id])}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </MuiTable>
        </TableContainer>

        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={data?.length || 0}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
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
            onClick={handleContinue}
          >
            Continue to Dashboard
          </Button>
        </Box>

      </Paper>
    </Box>
  );
}
