import React, { useState, useCallback, memo, useEffect } from "react";
import axios from "axios";
import ENV from "../config";

const S = {
  root: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    boxSizing: "border-box",
    background: "rgb(23,27,38)", // Deeper slate/navy matching the chart UI
    borderRadius: "8px",
    border: "1px solid hsla(0, 0.00%, 100.00%, 0.08)",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    color: "#D1D5DB",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 14px 10px",
    borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
    flexShrink: 0,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  headerLabel: {
    fontSize: "11px",
    fontWeight: 600,
    color: "#9CA3AF",
    letterSpacing: "0.8px",
    textTransform: "uppercase",
  },
  closeBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "2px",
    color: "#6B7280",
    display: "flex",
    alignItems: "center",
    lineHeight: 1,
    fontSize: "14px",
    transition: "color 0.2s",
  },
  inputArea: {
    padding: "12px 14px 10px",
    flexShrink: 0,
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    background: "#131722", // Darker inset background for the input
    border: "1px solid rgba(255, 255, 255, 0.06)",
    borderRadius: "6px",
    color: "#E5E7EB",
    fontSize: "12px",
    lineHeight: 1.5,
    padding: "10px 12px",
    outline: "none",
    resize: "none",
    fontFamily: "inherit",
    caretColor: "#22D3EE", // Cyan caret
    display: "block",
    transition: "border-color 0.2s",
  },
  btnRow: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: "12px",
    marginTop: "10px",
  },
  clearBtn: {
    background: "none",
    border: "none",
    color: "#6B7280",
    fontSize: "12px",
    cursor: "pointer",
    padding: "4px 8px",
    fontFamily: "inherit",
    transition: "color 0.2s",
  },
  saveBtn: (disabled) => ({
    background: "transparent",
    border: `1px solid ${disabled ? "rgba(34, 211, 238, 0.15)" : "rgba(34, 211, 238, 0.4)"}`,
    borderRadius: "4px",
    color: disabled ? "rgba(34, 211, 238, 0.4)" : "#22D3EE",
    fontSize: "12px",
    fontWeight: 500,
    padding: "5px 16px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit",
    letterSpacing: "0.3px",
    transition: "all 0.2s",
  }),
  dividerRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "0 14px",
    margin: "8px 0",
    flexShrink: 0,
  },
  dividerLine: {
    flex: 1,
    height: "1px",
    background: "rgba(255, 255, 255, 0.04)",
  },
  dividerCount: {
    fontSize: "10px",
    color: "#6B7280",
    fontWeight: 600,
    letterSpacing: "0.5px",
    textTransform: "uppercase",
  },
  notesList: {
    maxHeight: "150px",
    overflowY: "auto",
    padding: "0 14px 14px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    scrollbarWidth: "thin",
    scrollbarColor: "rgba(255, 255, 255, 0.1) transparent",
  },
  noteCard: (active) => ({
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    background: active ? "rgba(34, 211, 238, 0.04)" : "transparent",
    border: `1px solid ${active ? "rgba(34, 211, 238, 0.2)" : "rgba(255, 255, 255, 0.04)"}`,
    borderLeft: `2px solid ${active ? "#22D3EE" : "rgba(255, 255, 255, 0.1)"}`, // Clean left border accent
    borderRadius: "4px",
    padding: "8px 10px",
    cursor: "pointer",
    transition: "all 0.15s",
    flexShrink: 0,
  }),
  noteText: (active) => ({
    flex: 1,
    fontSize: "11.5px",
    color: active ? "#E5E7EB" : "#9CA3AF",
    lineHeight: 1.5,
    wordBreak: "break-word",
    paddingRight: "8px",
  }),
  deleteBtn: {
    background: "none",
    border: "none",
    color: "#4B5563",
    cursor: "pointer",
    padding: "2px",
    lineHeight: 1,
    flexShrink: 0,
    fontSize: "12px",
    fontFamily: "inherit",
    marginTop: "1px",
    transition: "color 0.2s",
  },
  emptyMsg: {
    textAlign: "center",
    color: "#6B7280",
    fontSize: "12px",
    padding: "16px 0 8px",
  },
};

const NoteTextarea = memo(({ data, onClose }) => {
  const [note, setNote] = useState("");
  const [savedNotes, setSavedNotes] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);

  useEffect(() => {
    if (!data?.data?.trade_id) return;
    axios
      .get(`${ENV.BASE_API_URL}/api/trade-notes/`, {
        params: { trade_id: data.data.trade_id },
        headers: { Authorization: `Bearer ${localStorage.getItem("jwtToken")}` },
      })
      .then((r) => setSavedNotes(r.data ?? []))
      .catch((e) => console.error("Fetch notes error:", e));
  }, [data?.data?.trade_id]);

  const handleSave = useCallback(async () => {
    const trimmed = note.trim();
    if (!trimmed) return;
    const isEdit = Boolean(editingId);
    try {
      const res = await axios({
        url: isEdit
          ? `${ENV.BASE_API_URL}/api/trade-notes/${editingId}/`
          : `${ENV.BASE_API_URL}/api/trade-notes/`,
        method: isEdit ? "put" : "post",
        data: isEdit
          ? { note: trimmed }
          : { trade_id: data?.data?.trade_id, note: trimmed },
        headers: { Authorization: `Bearer ${localStorage.getItem("jwtToken")}` },
      });
      setSavedNotes((prev) =>
        isEdit
          ? prev.map((n) => (n.id === editingId ? res.data : n))
          : [res.data, ...prev]
      );
      setNote("");
      setEditingId(null);
      setEditingIndex(null);
    } catch (e) {
      console.error("Save note error:", e);
    }
  }, [note, editingId, data?.data?.trade_id]);

  const handleDelete = useCallback(
    async (e, index) => {
      e.stopPropagation();
      const target = savedNotes[index];
      try {
        await axios.delete(`${ENV.BASE_API_URL}/api/trade-notes/${target.id}/`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("jwtToken")}` },
        });
        setSavedNotes((prev) => prev.filter((_, i) => i !== index));
        if (editingIndex === index) {
          setNote("");
          setEditingId(null);
          setEditingIndex(null);
        }
      } catch (e) {
        console.error("Delete note error:", e);
      }
    },
    [savedNotes, editingIndex]
  );

  const handleNoteClick = useCallback((n, i) => {
    setNote(n.note);
    setEditingId(n.id);
    setEditingIndex(i);
  }, []);

  const handleClear = useCallback(() => {
    setNote("");
    setEditingId(null);
    setEditingIndex(null);
  }, []);

  return (
    <div
      style={S.root}
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div style={S.header}>
        <div style={S.headerLeft}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22D3EE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 3v4a1 1 0 0 0 1 1h4" />
            <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
            <line x1="9" y1="9" x2="10" y2="9" />
            <line x1="9" y1="13" x2="15" y2="13" />
            <line x1="9" y1="17" x2="15" y2="17" />
          </svg>
          <span style={S.headerLabel}>
            {editingIndex !== null ? "Edit Note" : "Trade Notes"}
          </span>
        </div>
        <button
          style={S.closeBtn}
          onClick={onClose}
          title="Close"
          onMouseOver={(e) => e.currentTarget.style.color = "#9CA3AF"}
          onMouseOut={(e) => e.currentTarget.style.color = "#6B7280"}
        >
          ✕
        </button>
      </div>

      {/* Input */}
      <div style={S.inputArea}>
        <textarea
          rows={3}
          placeholder="Add a note…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={S.textarea}
          onFocus={(e) => e.target.style.borderColor = "rgba(34, 211, 238, 0.4)"}
          onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.06)"}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSave();
          }}
        />
        <div style={S.btnRow}>
          <button
            style={S.clearBtn}
            onClick={handleClear}
            onMouseOver={(e) => e.currentTarget.style.color = "#D1D5DB"}
            onMouseOut={(e) => e.currentTarget.style.color = "#6B7280"}
          >
            Clear
          </button>
          <button
            style={S.saveBtn(!note.trim())}
            disabled={!note.trim()}
            onClick={handleSave}
            onMouseOver={(e) => {
              if (note.trim()) {
                e.currentTarget.style.background = "rgba(34, 211, 238, 0.1)";
              }
            }}
            onMouseOut={(e) => {
              if (note.trim()) {
                e.currentTarget.style.background = "transparent";
              }
            }}
          >
            {editingIndex !== null ? "Update" : "Save"}
          </button>
        </div>
      </div>

      {/* Divider with count */}
      {savedNotes.length > 0 && (
        <div style={S.dividerRow}>
          <div style={S.dividerLine} />
          <span style={S.dividerCount}>
            {savedNotes.length} {savedNotes.length === 1 ? "NOTE" : "NOTES"}
          </span>
          <div style={S.dividerLine} />
        </div>
      )}

      {/* Notes list */}
      <div style={S.notesList}>
        {savedNotes.length === 0 ? (
          <div style={S.emptyMsg}>No notes yet</div>
        ) : (
          savedNotes.map((n, i) => {
            const active = editingIndex === i;
            return (
              <div
                key={n.id || i}
                style={S.noteCard(active)}
                onClick={() => handleNoteClick(n, i)}
              >
                <span style={S.noteText(active)}>{n.note}</span>
                <button
                  style={S.deleteBtn}
                  onClick={(e) => handleDelete(e, i)}
                  title="Delete"
                  onMouseOver={(e) => e.currentTarget.style.color = "#F87171"}
                  onMouseOut={(e) => e.currentTarget.style.color = "#4B5563"}
                >
                  ✕
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});

export default NoteTextarea;