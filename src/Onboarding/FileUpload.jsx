import React, { useState, useRef } from 'react'
import './FileUpload.css'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import ENV from '../config'

// ─── Broker config ─────────────────────────────────────────────────────────────
const BROKER_INSTRUCTIONS = {
  groww: {
    name: 'Groww',
    accentColor: '#00D09C',
    logo: 'G',
    reportName: 'Stocks P&L',
    tabs: null,
    steps: [
      { num: 1, text: 'Open Groww and tap your **Profile** icon (top-right corner)' },
      { num: 2, text: 'Inside Profile, tap **Reports** from the menu' },
      { num: 3, text: 'Go to **Profit & Loss** → select **Stocks P&L**' },
      { num: 4, text: 'Choose your **financial year** or a custom date range' },
      { num: 5, text: 'Tap **View**, then hit the **Download** button to save the file' },
    ],
  },

  zerodha: {
    name: 'Zerodha',
    accentColor: '#387ED1',
    logo: 'Z',
    reportName: 'Tradebook',
    tabs: null,
    steps: [
      { num: 1, text: 'Log in to **Console** at console.zerodha.com' },
      { num: 2, text: 'Click on **Reports** in the top navigation' },
      { num: 3, text: 'Click on **Tradebook**' },
      { num: 4, text: 'Set the **Segment** to **Equity**' },
      { num: 5, text: 'Select your **date range**, then click the **arrow (→)** button to load' },
      { num: 6, text: 'Hit the **Download** button to save the file' },
    ],
  },

  angleone: {
    name: 'AngelOne',
    accentColor: '#F6892A',
    logo: 'A',
    reportName: 'Trade History',
    tabs: [
      {
        id: 'website',
        label: '🖥  Website',
        steps: [
          { num: 1, text: 'Log in to your **AngelOne account** on the website' },
          { num: 2, text: 'Go to the **Account** section' },
          { num: 3, text: 'Click on **Trades and Charges**' },
          { num: 4, text: 'Click **Download Trade History** to save the file' },
        ],
      },
      {
        id: 'app',
        label: '📱  App',
        steps: [
          { num: 1, text: 'Open the AngelOne app and go to the **Account** section' },
          { num: 2, text: 'Go to **Trades and Charges**' },
          { num: 3, text: 'Tap the **Download** icon at the **top-right corner**' },
          { num: 4, text: 'Select **Download Trades & Charges**' },
          { num: 5, text: 'Choose the **year** you want, then tap **Download**' },
        ],
      },
    ],
  },
  angelone: {
    name: 'AngelOne',
    accentColor: '#F6892A',
    logo: 'A',
    reportName: 'Trade History',
    tabs: [
      {
        id: 'website',
        label: '🖥  Website',
        steps: [
          { num: 1, text: 'Log in to your **AngelOne account** on the website' },
          { num: 2, text: 'Go to the **Account** section' },
          { num: 3, text: 'Click on **Trades and Charges**' },
          { num: 4, text: 'Click **Download Trade History** to save the file' },
        ],
      },
      {
        id: 'app',
        label: '📱  App',
        steps: [
          { num: 1, text: 'Open the AngelOne app and go to the **Account** section' },
          { num: 2, text: 'Go to **Trades and Charges**' },
          { num: 3, text: 'Tap the **Download** icon at the **top-right corner**' },
          { num: 4, text: 'Select **Download Trades & Charges**' },
          { num: 5, text: 'Choose the **year** you want, then tap **Download**' },
        ],
      },
    ],
  },
}
// ───────────────────────────────────────────────────────────────────────────────

// Renders text with **bold** markers
const StepText = ({ text }) => {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  return (
    <span className="step-text">
      {parts.map((part, i) =>
        i % 2 === 1 ? <strong key={i}>{part}</strong> : part
      )}
    </span>
  )
}

const FileUpload = ({ selected_broker = 'zerodha', onDataUpload }) => {
  const brokerKey = selected_broker?.toLowerCase().replace(/\s+/g, '')
  const broker = BROKER_INSTRUCTIONS[brokerKey] || null
  const [activeTab, setActiveTab] = useState(0)

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const MAX_FILE_SIZE = 10 * 1024 * 1024
  const uploadBtnRef = useRef(null)
  const fileInputRef = useRef(null)

  const [isDragOver, setIsDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [fileSelected, setFileSelected] = useState(false)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')

  const navigate = useNavigate()

  React.useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 2500)
      return () => clearTimeout(timer)
    }
  }, [error])

  const allowedTypes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ]
  const validExtensions = ['.csv', '.xls', '.xlsx']

  const isValidFile = (file) => {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
    return validExtensions.includes(ext) && (allowedTypes.includes(file.type) || file.type === '')
  }

  const handleDragOver = (e) => { e.preventDefault(); setIsDragOver(true) }
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragOver(false) }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = e.dataTransfer.files
    if (files.length > 0) handleFileUpload(files[0])
  }

  const handleFileSelect = (e) => {
    const files = e.target.files
    if (files.length > 0) handleFileUpload(files[0])
  }

  const handleFileUpload = (file) => {
    setError('')
    if (!isValidFile(file)) {
      setError('Only CSV or Excel (.csv, .xls, .xlsx) files are allowed.')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('Max file size exceeded (10 MB).')
      return
    }
    setSelectedFile(file)
    setFileName(file.name)
    setFileSelected(true)
    setTimeout(() => { uploadBtnRef.current?.click() }, 0)
  }

  const handleUploadClick = async () => {
    if (!selectedFile) { setError('No file selected'); return }
    const formData = new FormData()
    formData.append('file', selectedFile)
    setIsUploading(true)
    setError('')
    try {
      const res = await axios.post(
        `${ENV.BASE_API_URL}/api/upload-trades/`,
        formData,
        {
          params: { broker: selected_broker },
          headers: {
            Authorization: `Bearer ${localStorage.getItem('jwtToken')}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      )
      onDataUpload(res.data)
    } catch (err) {
      setError('Upload failed. Try again.')
    } finally {
      setIsUploading(false)
    }
  }

  const activeSteps = broker?.tabs
    ? broker.tabs[activeTab].steps
    : broker?.steps

  return (
    <div className="file-upload-container">

      {broker ? (
        <div className="instruction-panel">

          <div className="instruction-header">
            <div className="broker-logo" style={{ background: broker.accentColor }}>
              {broker.logo}
            </div>
            <div>
              <p className="instruction-title">
                How to get your <strong>{broker.reportName}</strong> from {broker.name}
              </p>
              <p className="instruction-sub">Follow these steps, then upload the file below</p>
            </div>
          </div>

          {broker.tabs && (
            <div className="tab-row">
              {broker.tabs.map((tab, idx) => (
                <button
                  key={tab.id}
                  className={`tab-btn ${activeTab === idx ? 'tab-btn--active' : ''}`}
                  style={activeTab === idx ? { borderColor: broker.accentColor, color: broker.accentColor, background: broker.accentColor + '12' } : {}}
                  onClick={() => setActiveTab(idx)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          <ol className="step-list">
            {activeSteps.map((step) => (
              <li key={step.num} className="step-item">
                <span className="step-num" style={{ background: broker.accentColor }}>
                  {step.num}
                </span>
                <StepText text={step.text} />
              </li>
            ))}
          </ol>

        </div>
      ) : (
        <div className="instruction-panel instruction-panel--soon">
          <span className="soon-icon">🔧</span>
          <div>
            <p className="soon-title">
              Step-by-step guide coming soon for <strong style={{ textTransform: 'capitalize' }}>{selected_broker}</strong>
            </p>
            <p className="soon-sub">You can still upload your P&L file below in the meantime.</p>
          </div>
        </div>
      )}

      {!fileSelected ? (
        <div
          className={`drop-zone ${isDragOver ? 'drag-over' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="drop-zone-content">
            <div className="upload-icon">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <p className="drop-text">Drag and Drop File Here</p>
            <p className="drop-subtext">.csv · .xls · .xlsx · max 10 MB</p>
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
                setSelectedFile(null)
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
            <button className="action-btn file-btn" onClick={() => fileInputRef.current?.click()}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span>Select File</span>
            </button>
          ) : (
            <button
              className="action-btn upload-btn"
              ref={uploadBtnRef}
              onClick={handleUploadClick}
              disabled={isUploading}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span>{isUploading ? 'Uploading...' : 'Submit'}</span>
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