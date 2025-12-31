import React, { useState, useCallback, memo, useEffect } from "react";
import axios from "axios";
import ENV from "../config";

const NoteTextarea = memo(({ data, onClose, x, y, width, height }) => {
  const [note, setNote] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [savedNotes, setSavedNotes] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    const checkWidth = () => setIsMobile(window.innerWidth <= 600);
    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  useEffect(() => {
    if (!data?.data?.symbol) return;

    const fetchNotes = async () => {
      try {
        const res = await axios.get(
          `${ENV.BASE_API_URL}/api/trade-notes/`,
          {
            params: { trade_id: data.data.trade_id },
            headers: {
              Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
            },
          }
        );
        setSavedNotes(res.data ?? []);
      } catch (err) {
        console.error("Fetch notes error:", err);
      }
    };

    fetchNotes();
  }, [data?.data?.symbol]);


  const handleChange = useCallback((e) => setNote(e.target.value), []);
  const handleUndo = useCallback(() => {
    setNote("");
    setEditingIndex(null);
    setEditingId(null);
  }, []);

  const handleSave = useCallback(async () => {

    const trimmed = note.trim();
    if (!trimmed) return;

    const isEdit = Boolean(editingId);

    console.log("isEdit:", isEdit);
    const url = isEdit
      ? `${ENV.BASE_API_URL}/api/trade-notes/${editingId}/`
      : `${ENV.BASE_API_URL}/api/trade-notes/`;

    const method = isEdit ? "put" : "post";

    console.log("data:", data);
    console.log("data?.trade_id ----->", data?.data?.trade_id);
    const payload = isEdit
      ? { note: trimmed }
      : { trade_id: data?.data?.trade_id, note: trimmed };

    try {
      const res = await axios({
        url,
        method,
        data: payload,
        headers: {
          Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
        },
      });

      setSavedNotes((prev) =>
        isEdit
          ? prev.map((n) => (n.id === editingId ? res.data : n))
          : [res.data, ...prev]
      );

      setNote("");
      setEditingId(null);
      setEditingIndex(null);
    } catch (err) {
      console.error("Save note error:", err);
    }
  }, [note, editingId, data?.trade_id]);


  const handleNoteClick = useCallback((n, i) => {
    setNote(n.note);
    setEditingIndex(i);
    setEditingId(n.id);
  }, []);

  const handleDelete = useCallback(async (index) => {
    const noteToDelete = savedNotes[index];
    try {
      await axios.delete(`${ENV.BASE_API_URL}/api/trade-notes/${noteToDelete.id}/`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('jwtToken')}` },
      });
      setSavedNotes((prev) => prev.filter((_, i) => i !== index));
    } catch (err) {
      console.error("Delete note error:", err);
    }
  }, [savedNotes]);

  return (
    <div
      className="bg-gray-900/95 p-3 rounded-lg font-sans text-gray-300 shadow-lg transition-all duration-200 flex flex-col"
      style={{
        position: "absolute",
        // left: x,
        // top: y,
        width: width,
        height: height - 50,
        overflowY: "auto",
      }}
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-gray-400 font-medium">
          {editingIndex !== null ? "Edit Note" : "Add Note"}
        </span>
        <button type="button" onClick={onClose} className="p-1 flex items-center justify-center">
          <CloseIcon />
        </button>
      </div>

      {/* Textarea */}
      <textarea
        placeholder="Add your notes here"
        value={note}
        onChange={handleChange}
        rows={isMobile ? 4 : 3}
        className="flex-shrink-0 w-full bg-gray-800/85 border border-gray-500/35 rounded-md text-gray-300 text-sm p-2 outline-none resize-none"
      />

      {/* Buttons */}
      <div className="flex mt-2 gap-2 justify-end">
        <button
          type="button"
          onClick={handleUndo}
          className="bg-gray-700/90 text-gray-400 text-sm font-semibold px-3 py-1 rounded"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!note.trim()}
          className={`bg-gray-600/95 text-gray-200 text-sm font-semibold px-3 py-1 rounded transition-opacity duration-200 ${!note.trim() ? "opacity-50 cursor-not-allowed" : "opacity-100"
            }`}
        >
          {editingIndex !== null ? "Update" : "Save"}
        </button>
      </div>

      {/* History */}
      <div className="mt-3 flex-1 pr-1">
        {savedNotes.length === 0 ? (
          <div className="text-center text-gray-500 text-sm mt-4">No notes yet.</div>
        ) : (
          savedNotes.map((n, i) => (
            <div
              key={n.id || i}
              className="flex justify-between items-center bg-gray-800/90 rounded-md px-2 py-2 mb-2 text-sm text-gray-300 border-l-4 border-gray-600 cursor-pointer"
            >
              <div onClick={() => handleNoteClick(n, i)} className="flex-1">
                {n.note}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(i);
                }}
                className="text-white text-xs ml-1 bg-transparent px-1 py-0.5 rounded"
              >
                x
              </button>
            </div>
          ))
        )}
      </div>
    </div>

  );
});

const CloseIcon = memo(() => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 18 18"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <line x1="4" y1="4" x2="14" y2="14" stroke="#c0c7d0" strokeWidth="2" strokeLinecap="round" />
    <line x1="14" y1="4" x2="4" y2="14" stroke="#c0c7d0" strokeWidth="2" strokeLinecap="round" />
  </svg>
));

export default NoteTextarea;
