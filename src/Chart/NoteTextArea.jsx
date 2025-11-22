import React, { useState, useCallback, memo, useEffect } from "react";
import axios from "axios";
import ENV from "../config";


const NoteTextarea = memo(({ data, onClose }) => {

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

  // 🔹 Fetch notes from backend
  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const res = await axios.get(`${ENV.BASE_API_URL}/api/notes/?stock=${data?.data?.symbol}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('jwtToken')}` },
        });
        setSavedNotes(res.data || []);
      } catch (err) {
        console.error("Fetch notes error:", err);
      }
    };
    fetchNotes();
  }, [data?.symbol]);

  const handleChange = useCallback((e) => setNote(e.target.value), []);

  const handleUndo = useCallback(() => {
    setNote("");
    setEditingIndex(null);
    setEditingId(null);
  }, []);

  // 🔹 Save or Update Note
  const handleSave = useCallback(async () => {
    const trimmed = note.trim();
    if (!trimmed) return;

    try {
      if (editingId) {
        const res = await axios.put(`${ENV.BASE_API_URL}/api/notes/${editingId}/`, {
          content: trimmed,
        }, {
          headers: { Authorization: `Bearer ${localStorage.getItem('jwtToken')}` },
        });
        setSavedNotes((prev) =>
          prev.map((n) => (n.id === editingId ? res.data : n))
        );
      } else {
        const res = await axios.post(`${ENV.BASE_API_URL}/api/notes/`, {
          stock: data?.symbol,
          content: trimmed,
        }, {
          headers: { Authorization: `Bearer ${localStorage.getItem('jwtToken')}` },
        })
        setSavedNotes((prev) => [res.data, ...prev]);
      }
      setNote("");
      setEditingIndex(null);
      setEditingId(null);
    } catch (err) {
      console.error("Save note error:", err);
    }
  }, [note, editingId, data?.symbol]);

  // 🔹 Edit
  const handleNoteClick = useCallback((n, i) => {
    setNote(n.content);
    setEditingIndex(i);
    setEditingId(n.id);
  }, []);

  // 🔹 Delete
  const handleDelete = useCallback(
    async (index) => {
      const noteToDelete = savedNotes[index];
      try {
        await axios.delete(`${ENV.BASE_API_URL}/api/notes/${noteToDelete.id}/`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('jwtToken')}` },
        });
        setSavedNotes((prev) => prev.filter((_, i) => i !== index));
      } catch (err) {
        console.error("Delete note error:", err);
      }
    },
    [savedNotes]
  );

  const dynamic = getDynamicStyles(isMobile);

  return (
    <div
      style={{ ...styles.container, ...dynamic.container }}
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ ...styles.header, ...dynamic.header }}>
        <span style={styles.title}>
          {editingIndex !== null ? "Edit Note" : "Add Note"}
        </span>
        <button type="button" onClick={onClose} style={styles.closeButton}>
          <CloseIcon />
        </button>
      </div>

      <textarea
        placeholder="Add your notes here"
        value={note}
        onChange={handleChange}
        style={{ ...styles.textarea, ...dynamic.textarea }}
        rows={isMobile ? 4 : 3}
      />

      <div style={{ ...styles.buttonRow, ...dynamic.buttonRow }}>
        <button
          type="button"
          style={{ ...styles.button, ...styles.undoBtn }}
          onClick={handleUndo}
        >
          Undo
        </button>
        <button
          type="button"
          style={{
            ...styles.button,
            ...styles.saveBtn,
            opacity: note.trim() ? 1 : 0.5,
          }}
          onClick={handleSave}
          disabled={!note.trim()}
        >
          {editingIndex !== null ? "Update" : "Save"}
        </button>
      </div>

      <div style={{ ...styles.history, ...dynamic.history }}>
        {savedNotes.length === 0 ? (
          <div style={styles.emptyText}>No notes yet.</div>
        ) : (
          savedNotes.map((n, i) => (
            <div
              key={n.id || i}
              style={{
                ...styles.noteItem,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div
                onClick={() => handleNoteClick(n, i)}
                style={{ flex: 1, cursor: "pointer" }}
              >
                {n.content}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(i);
                }}
                style={styles.deleteBtn}
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

// CloseIcon, styles, and getDynamicStyles stay the same


const CloseIcon = memo(() => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 18 18"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: "block" }}
  >
    <line
      x1="4"
      y1="4"
      x2="14"
      y2="14"
      stroke="#c0c7d0"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <line
      x1="14"
      y1="4"
      x2="4"
      y2="14"
      stroke="#c0c7d0"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
));

const styles = {
  container: {
    resize: "both",
    overflow: "auto",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    backgroundColor: "rgba(34, 38, 45, 0.95)",
    borderRadius: 8,
    padding: "12px 14px 14px",
    width: 320,
    color: "#c0c7d0",
    boxSizing: "border-box",
    boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
    transition: "all 0.25s ease",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  title: {
    fontSize: 13,
    color: "#9aa5b1",
    fontWeight: 500,
  },
  closeButton: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  textarea: {
    width: "95%",
    backgroundColor: "rgba(26, 30, 36, 0.85)",
    border: "1px solid rgba(120, 130, 140, 0.35)",
    borderRadius: 6,
    color: "#c0c7d0",
    fontSize: 13,
    padding: 8,
    resize: "none",
    outline: "none",
  },
  buttonRow: {
    marginTop: 10,
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
  },
  button: {
    fontSize: 13,
    padding: "6px 14px",
    borderRadius: 5,
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    transition: "opacity 0.2s ease",
  },
  undoBtn: {
    backgroundColor: "rgba(55, 60, 70, 0.9)",
    color: "#8a919e",
  },
  saveBtn: {
    backgroundColor: "rgba(90, 95, 105, 0.95)",
    color: "#e0e4eb",
  },
  history: {
    marginTop: 14,
    maxHeight: 70,
    overflowY: "auto",
    paddingRight: 4,
  },
  noteItem: {
    background: "rgba(44, 48, 56, 0.9)",
    borderRadius: 6,
    padding: "9px 10px",
    marginBottom: 8,
    fontSize: 13,
    color: "#c9cfd8",
    borderLeft: "3px solid #5a606b",
    cursor: "pointer",
  },
  deleteBtn: {
    background: "rgba(255, 60, 60, 0.0)",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    padding: "2px 6px",
    cursor: "pointer",
    fontSize: 11,
    marginLeft: 6,
  },
  emptyText: {
    textAlign: "center",
    color: "#6c7680",
    fontSize: 13,
    marginTop: 18,
  },
};

const getDynamicStyles = (isMobile) =>
  isMobile
    ? {
      container: {
        width: "92vw",
        padding: "10px 12px",
        borderRadius: 10,
      },
      header: { marginBottom: 8 },
      textarea: { fontSize: 14, minHeight: 80 },
      buttonRow: { marginTop: 8, justifyContent: "space-between" },
      history: { maxHeight: 120 },
    }
    : {};

export default NoteTextarea;
