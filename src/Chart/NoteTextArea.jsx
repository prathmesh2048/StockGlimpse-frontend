import React, { useState } from "react";

const NoteTextarea = () => {
  const [note, setNote] = useState("");
  const [isEditing, setIsEditing] = useState(true);

  return (
    <div style={styles.overlay}>
      <div style={styles.noteBox}>
        <button
          aria-label="Close"
          style={styles.closeButton}
          onClick={() => setIsEditing(false)}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            style={{ display: "block" }}
            xmlns="http://www.w3.org/2000/svg"
          >
            <line x1="4" y1="4" x2="14" y2="14" stroke="#c0c7d0" strokeWidth="2" strokeLinecap="round"/>
            <line x1="14" y1="4" x2="4" y2="14" stroke="#c0c7d0" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
        <div style={styles.title}>Note</div>
        <textarea
          placeholder="Add your notes here"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={styles.textarea}
          rows={4}
        />
        <div style={styles.buttons}>
          <button
            style={{ ...styles.button, ...styles.cancelBtn }}
            onClick={() => {
              setNote("");
              setIsEditing(false);
            }}
          >
            Cancel
          </button>
          <button
            style={{ ...styles.button, ...styles.saveBtn }}
            onClick={() => setIsEditing(false)}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    zIndex: 1000,
    position: "fixed",
    top: "40%",
    left: "60%",
    transform: "translate(-50%, -50%)",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  noteBox: {
    backgroundColor: "rgba(38, 42, 48, 0.9)",
    borderRadius: 8,
    padding: "16px 42px 16px 16px",
    width: 280,
    boxShadow:
      "0 4px 6px rgba(0,0,0,0.3), inset 0 0 5px rgba(255,255,255,0.05)",
    color: "#9aa5b1",
    position: "relative",
  },
  closeButton: {
    position: "absolute",
    top: 10,
    right: 10,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: 4,
    borderRadius: "50%",
    transition: "background 0.2s",
    outline: "none",
    width: 28,
    height: 28,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontWeight: "600",
    fontSize: 16,
    marginBottom: 8,
    color: "#c0c7d0",
    textAlign: "left",
    marginTop: 8,
  },
  textarea: {
    width: "100%",
    backgroundColor: "rgba(28, 32, 38, 0.7)",
    border: "1px solid rgba(100, 110, 125, 0.4)",
    borderRadius: 4,
    color: "#8795a1",
    fontSize: 14,
    padding: 8,
    resize: "none",
    outline: "none",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  buttons: {
    marginTop: 12,
    display: "flex",
    justifyContent: "flex-end",
    gap: 12,
  },
  button: {
    fontSize: 14,
    padding: "6px 14px",
    borderRadius: 4,
    border: "none",
    cursor: "pointer",
    fontWeight: "600",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  cancelBtn: {
    backgroundColor: "rgba(60, 65, 75, 0.8)",
    color: "#8a919e",
  },
  saveBtn: {
    backgroundColor: "rgba(75, 80, 90, 0.9)",
    color: "#c0c7d0",
  },
};

export default NoteTextarea;