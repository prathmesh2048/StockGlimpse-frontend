import React, { useState, useCallback, memo, useEffect } from "react";

const NoteTextarea = memo(({ data, onClose }) => {
  const [note, setNote] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [savedNotes, setSavedNotes] = useState([
    "Bought at support, expecting bounce.",
    "Sold after resistance break.",
    "Watching for volume spike.",
  ]);

  // 🔹 Responsive handling
  useEffect(() => {
    const checkWidth = () => setIsMobile(window.innerWidth <= 600);
    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  const handleChange = useCallback((e) => setNote(e.target.value), []);
  const handleCancel = useCallback(() => setNote(""), []);
  const handleSave = useCallback(() => {
    const trimmed = note.trim();
    if (!trimmed) return;
    setSavedNotes((prev) => [trimmed, ...prev]);
    setNote("");
  }, [note]);

  const handleNoteClick = useCallback((n) => setNote(n), []); // ✅ populate textarea

  const dynamic = getDynamicStyles(isMobile);

  return (
    <div
      style={{ ...styles.container, ...dynamic.container }}
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div style={{ ...styles.header, ...dynamic.header }}>
        <span style={styles.title}>Add Note</span>
        <button
          type="button"
          onClick={onClose}
          style={styles.closeButton}
          aria-label="Close"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Textarea */}
      <textarea
        placeholder="Add your notes here"
        value={note}
        onChange={handleChange}
        style={{ ...styles.textarea, ...dynamic.textarea }}
        rows={isMobile ? 4 : 3}
      />

      {/* Buttons */}
      <div style={{ ...styles.buttonRow, ...dynamic.buttonRow }}>
        <button
          type="button"
          style={{ ...styles.button, ...styles.cancelBtn }}
          onClick={handleCancel}
        >
          Cancel
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
          Save
        </button>
      </div>

      {/* History */}
      <div style={{ ...styles.history, ...dynamic.history }}>
        {savedNotes.length === 0 ? (
          <div style={styles.emptyText}>No notes yet.</div>
        ) : (
          savedNotes.map((n, i) => (
            <div
              className="note-item"
              key={i}
              style={styles.noteItem}
              onClick={() => handleNoteClick(n)} // ✅ working click
            >
              {n}
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
  cancelBtn: {
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
