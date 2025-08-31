import React, { useState, useRef } from 'react'
import './FileUpload.css'
import axios from 'axios';
import ENV from '../config';




const FileUpload = () => {

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

  const [isDragOver, setIsDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileSize, setFileSize] = useState(`0 B / ${formatFileSize(MAX_FILE_SIZE)}`)
  const [isUploading, setIsUploading] = useState(false)
  const [fileSelected, setFileSelected] = useState(false)
  const [fileName, setFileName] = useState('')
  const fileInputRef = useRef(null)
  const [error, setError] = useState('')

  React.useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 2500)
      return () => clearTimeout(timer)
    }
  }, [error])


  const allowedTypes = [
    "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ]
  const validExtensions = [".csv", ".xls", ".xlsx"]

  const isValidFile = (file) => {
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase()
    return validExtensions.includes(ext) && (allowedTypes.includes(file.type) || file.type === "")
  }


  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileUpload(files[0])
    }
  }

  const handleFileSelect = (e) => {
    const files = e.target.files
    if (files.length > 0) {
      handleFileUpload(files[0])
    }
  }

  const handleFileUpload = (file) => {

    setError('')

    if (!allowedTypes.includes(file.type)) {
      setError("Only CSV or Excel (.csv, .xls, .xlsx) files are allowed.")
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("Max file size exceeded (10 MB).")
      return
    }

    setSelectedFile(file)
    setFileSize(`${formatFileSize(file.size)} / ${formatFileSize(MAX_FILE_SIZE)}`)
    setFileName(file.name)
    setFileSelected(true)
  }


  const handleImageClick = () => {
    fileInputRef.current?.click()
  }

  const handleUploadClick = async () => {
    if (!selectedFile) {
      setError('No file selected')
      return
    }

    const formData = new FormData()
    formData.append('file', selectedFile)

    setIsUploading(true)
    setError('')

    try {
      const res = await axios.post(
        `${ENV.BASE_API_URL}/api/upload-trades/`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('jwtToken')}`,
            'Content-Type': 'multipart/form-data',
          }
        }
      )
      console.log('response received:', res.data)
    } catch (err) {
      setError('Upload failed. Try again.')
    } finally {
      setIsUploading(false)
    }
  }


  return (
    <div className="file-upload-container">

      {!fileSelected ? (
        <div className={`drop-zone ${isDragOver ? 'drag-over' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleImageClick}
        >
          <div className="drop-zone-content">
            <div className="upload-icon">
              <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <p className="drop-text">Drag and Drop File Here</p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv, .xls, .xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>
      ) : (
        <div className="file-info">
          <div className="file-pill">
            <span className="file-name">📄 {fileName}</span>
            <button
              className="file-remove"
              onClick={() => {
                setFileSelected(false)
                setFileName('')
                setFileSize(`0 B / ${formatFileSize(MAX_FILE_SIZE)}`)
                setSelectedFile(null)   // ✅ clear file
                if (fileInputRef.current) fileInputRef.current.value = null
              }}
            >
              ❌
            </button>
          </div>
        </div>
      )}

      <div className="upload-header">
        <div className="action-buttons">
          {!fileSelected ? (
            <button
              className="action-btn file-btn"
              onClick={handleImageClick}
              title="Select File">
              <svg
                width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span>Select File</span>
            </button>
          ) : (
            <button
              className="action-btn upload-btn"
              onClick={handleUploadClick}
              title="Upload"
              disabled={isUploading}
            >
              <svg
                width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span>Submit</span>
            </button>
          )}
        </div>

      </div>
      {error && (
        <div className="alert-popup">
          <span>{error}</span>
          <button onClick={() => setError('')}>✖</button>
        </div>
      )}

    </div>

  )
}

export default FileUpload
