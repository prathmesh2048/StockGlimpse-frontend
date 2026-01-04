import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import TradeConfirmModal from "./TradeConfirmModal";
import useUser from "../hooks/useUser";
import axios from "axios";
import ENV from '../config';

export default function Table({ data, title = "Please select the trades you want to visualize -:", fromHistory = false }) {

  const { user, loading } = useUser();

  const navigate = useNavigate();
  const getRowId = (row) => row.trade_id;

  const [order, setOrder] = useState("asc");
  const [orderBy, setOrderBy] = useState(Object.keys(data?.[0] || {})[0] || "");
  const [selected, setSelected] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const headCells = data?.[0]
    ? Object.keys(data[0]).map((key) => ({
      id: key,
      label: key.replace(/_/g, " ").toUpperCase(),
    }))
    : [];

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const handleSelectAllClick = (e) => {
    setSelected(e.target.checked ? data.map(getRowId) : []);
  };

  const handleClick = (row) => {
    const id = getRowId(row);
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const [open, setOpen] = useState(false);

  const handleConfirm = () => {
    const selectedRows = data.filter((row) => selected.includes(getRowId(row)));
    const tradesBySymbol = selectedRows.reduce((acc, row) => {
      if (!acc[row.symbol]) acc[row.symbol] = [];
      acc[row.symbol].push(row);
      return acc;
    }, {});
    navigate("/temp", { state: { tradesBySymbol, fromHistory } });
    setOpen(false);
  };

  const handleConfirmWithCoins = async () => {

    const vizId = crypto.randomUUID();
    localStorage.setItem("viz_id", vizId);
    console.log("selected trades for coin deduction:", selected);

    try {
      await axios.post(
        `${ENV.BASE_API_URL}/api/deduct-coins/`,
        {
          visualization_id: vizId,
          trade_ids: selected,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
          },
        }
      );

      handleConfirm();
    } catch (err) {
      console.error("Coin deduction failed", err);
    }
  };


  const handleContinueToDashboard = () => {
    if (fromHistory || user?.has_unlimited_coins) {
      // Directly navigate if fromHistory
      handleConfirm();
    } else {
      // Open modal for confirmation
      setOpen(true);
    }
  };

  let groupedData = data;
  if (fromHistory && data?.length) {
    groupedData = Object.values(
      data.reduce((acc, row) => {
        const key = dayjs(row.created_at).format("YYYY-MM-DD");
        if (!acc[key]) acc[key] = { ...row, _group: key, rows: [] };
        acc[key].rows.push(row);
        return acc;
      }, {})
    );
  }


  useEffect(() => {
    if (data?.length) setSelected(data.map(getRowId));
  }, [data]);

  return (
    <div className="w-full p-4">
      <TradeConfirmModal
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirmWithCoins}
        trades={selected.length}
        coinsUsed={selected.length}
        balance={user?.coins || 0}
        remaining={(user?.coins || 0) - selected.length}
      />

      <h2 className="text-xl font-bold mb-4">{title}</h2>
      <div className="overflow-x-auto bg-white shadow rounded-lg border border-300">
        <table className="min-w-full divide-y divide-200 border border-300">

          <thead className="bg-blue-300 text-white">
            <tr>
              <th className="px-4 py-2">
                <input
                  type="checkbox"
                  checked={selected.length === data.length && data.length > 0}
                  onChange={handleSelectAllClick}
                  className="h-4 w-4 text-blue-600"
                />
              </th>
              {headCells.map((headCell) => (
                <th
                  key={headCell.id}
                  onClick={() => handleRequestSort(headCell.id)}
                  className="px-4 py-2 text-left text-sm font-medium text-gray-700 cursor-pointer select-none"
                >
                  {headCell.label} {orderBy === headCell.id ? (order === "asc" ? "▲" : "▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {groupedData
              .sort((a, b) => {
                const x = a._group || a[orderBy];
                const y = b._group || b[orderBy];
                if (x < y) return order === "asc" ? -1 : 1;
                if (x > y) return order === "asc" ? 1 : -1;
                return 0;
              })
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((group) => {
                const rows = group.rows || [group];
                return (
                  <React.Fragment key={group._group || getRowId(group)}>
                    {group._group && (
                      <tr className="bg-gray-100">
                        <td colSpan={headCells.length + 1} className="px-6 py-3 font-medium text-md">
                          {`Trades Uploaded at ${dayjs(group._group).format("MMM D, YYYY")}`}
                        </td>
                      </tr>
                    )}
                    {rows.map((row) => {
                      const id = getRowId(row);
                      const isSelected = selected.includes(id);
                      return (
                        <tr key={id} className={`hover:bg-gray-50 ${isSelected ? "bg-blue-50" : ""}`}>
                          <td className="px-4 py-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleClick(row)}
                              className="h-4 w-4 text-blue-600"
                            />
                          </td>
                          {headCells.map((cell) => (
                            <td key={cell.id} className="px-4 py-2 text-sm text-gray-700">
                              {cell.id === "auction" ? (row[cell.id] ? "Yes" : "No") : String(row[cell.id])}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
          </tbody>

        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <div>
          Rows per page:
          <select
            className="ml-2 border rounded px-2 py-1"
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
          >
            {[5, 10, 25].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="space-x-2">
          <button
            className="px-3 py-1 border rounded hover:bg-gray-100"
            onClick={() => setPage((p) => Math.max(p - 1, 0))}
          >
            Prev
          </button>
          <button
            className="px-3 py-1 border rounded hover:bg-gray-100"
            onClick={() => setPage((p) => (p + 1) * rowsPerPage < data.length ? p + 1 : p)}
          >
            Next
          </button>
        </div>
      </div>

      <div className="flex justify-end mt-4">
        <button
          onClick={handleContinueToDashboard}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center space-x-2"
        >
          <span>Continue to Dashboard</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </button>
      </div>
    </div>
  );
}
