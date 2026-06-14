import * as d3 from 'd3';
import domtoimage from 'dom-to-image-more';
import {
  annotation,
  annotationLabel,
  annotationCalloutCurve,
  annotationCustomType,
  annotationCalloutRect
} from 'd3-svg-annotation';
import html2canvas from 'html2canvas';
import { toBlob } from 'html-to-image';
import axios from 'axios';
import ENV from "../config"; // import your config file

import { colors, config, getCursorPoint, parseDate, modifyAnnotationEnd, createToolsBtns } from './CandleStickChartUtils.jsx';
import { placeWithoutOverlap, drawBrushGradient } from './Utils';

class CandleStickChart {

  #colors;
  #config;
  #maxPrice;
  #lockSelectorX;
  #objectIDs;
  #xScaleFunc;
  #yScaleFunc;
  #candleWidth;
  #candleWidthDate;
  #candleLockerWidth;
  #candleLockerWidthDate;
  #filteredData;
  #mode;
  #drawAndMeasureLocked = false;
  #isMouseDown = false;
  #zoomPoint1;
  #zoomPoint2;
  #zoomRange1;
  #zoomRange2;
  #minMaxDate;
  #zoomFactor = 1;
  #panTargetDate;
  #drawPoint1 = null;
  #drawPoint2 = null;
  #tempLine = null;
  #measureState = null;
  #chartMode = null;
  #annotationsData = [];
  #theme = null;
  #annotationCache = new Map();
  #isPnLWindowClosed = false;
  #lineData = [];
  #rightOffsetFactor = 0.40;
  #snrLevels = [];
  #srLevelsFetching = false;
  #isPaid = false;

  #candlePattern = null;
  #candlePatternFetching = false;
  #candlePatternActive = false;
  #brushState = null

  #ema9 = null;
  #ema21 = null;
  #ema50 = null;
  #ema200 = null;

  // ── Panel layout ─────────────────────────────────────
  // Heights are fractions of the total SVG height
  #PRICE_RATIO = 0.70;
  #VOLUME_RATIO = 0.15;
  #RSI_RATIO = 0.15;
  #PANEL_GAP = 4; // px gap between panels


  // Toggles for additional panels (volume, RSI)
  #showVolume = false;
  #showRSI = false;

  // Derived pixel heights (set in #calculatePanelHeights)
  #priceH = 0;
  #volumeH = 0;
  #rsiH = 0;
  #volumeTop = 0; // Y offset where volume panel starts
  #rsiTop = 0; // Y offset where RSI panel starts
  #totalSvgH = 0; // full SVG height covering all panels

  // RSI data
  #rsiData = [];


  constructor(width, height, data, stockAnnotationsData, id, theme = "dark", isPaid) {
    this.#theme = theme
    this.#colors = colors(theme);
    this.#config = config(width, height);
    this.#maxPrice = d3.max(data.map((x) => x.High));
    this.data = data.sort((a, b) => parseDate(a) - parseDate(b));
    this.#annotationsData = stockAnnotationsData;
    this.#filteredData = data;
    this.id = id;
    this.#isPaid = isPaid;
    this.#lockSelectorX = false;
    this.#calculateExtendConfigs();
    this.#setObjectIDs();
    let minMaxDate = d3.extent(data.map((x) => parseDate(x.Date)));
    this.#calculateCandleWidthDate();
    this.#minMaxDate = minMaxDate;
    this.#zoomRange1 = minMaxDate[0].getTime() - this.#candleWidthDate / 2;

    const totalRange =
      minMaxDate[1].getTime() - minMaxDate[0].getTime();

    const rightPadding = totalRange * this.#rightOffsetFactor;

    this.#zoomRange2 =
      minMaxDate[1].getTime() + rightPadding;


    this.#createToolsBtns();
    this.#measureState = {
      active: false,
      start: null,
      rect: null,
      label: null,
    };

    this.#modeHandler('pan');
    this.#chartMode = 'line';
    this.#annotationCache = this.#annotationCache || new Map();
    this.#rsiData = this.#calculateRSI(14);

    document.getElementById(this.id)?.addEventListener('ema-toggle', (e) => {
      const { period, active } = e.detail;

      if (active) {
        // Temporarily use full data for EMA calculation for accuracy
        const savedFiltered = this.#filteredData;
        this.#filteredData = this.data;
        const emaData = this.#calculateEMA(period);
        this.#filteredData = savedFiltered;

        if (period === 9) this.#ema9 = emaData;
        if (period === 21) this.#ema21 = emaData;
        if (period === 50) this.#ema50 = emaData;
        if (period === 200) this.#ema200 = emaData;

      } else {
        if (period === 9) this.#ema9 = null;
        if (period === 21) this.#ema21 = null;
        if (period === 50) this.#ema50 = null;
        if (period === 200) this.#ema200 = null;
      }

      this.#drawEMALines();   // ← just redraw lines, no full chart redraw
    });

    document.getElementById(this.id)?.addEventListener("ailevels-toggle", () => {

      if (!this.#isPaid) {
        this.#showUpgradeToast("AI Levels");
        return;
      }
      if (!this.#snrLevels || this.#snrLevels.length === 0) {
        if (this.#srLevelsFetching) return;
        this.#fetchSRLevels();
      } else if (d3.select(`#${this.#objectIDs.svgId}`).selectAll('.sr-level').empty()) {
        this.#drawSRLevels();
      } else {
        d3.select(`#${this.#objectIDs.svgId}`).selectAll('.sr-level').remove();
      }
    });


    document.getElementById(this.id)?.addEventListener("volume-toggle", () => {
      this.#showVolume = !this.#showVolume;
      this.draw();
    });

    document.getElementById(this.id)?.addEventListener("rsi-toggle", () => {
      this.#showRSI = !this.#showRSI;
      this.draw();
    });


    document.getElementById(id)?.addEventListener("candle-pattern-toggle", () => {
      if (!this.#isPaid) {
        this.#showUpgradeToast("Candle Pattern"); // 👈
        return;
      }
      if (!this.#candlePattern || this.#candlePattern.patterns?.length === 0) {
        if (this.#candlePatternFetching) return;
        this.#fetchCandlePattern();
      } else if (this.#candlePatternActive) {
        this.#candlePatternActive = false;
        d3.select(`#${this.#objectIDs.svgId}`)
          .selectAll('.candle-pattern-highlight')
          .interrupt()
          .style("stroke", null)
          .style("filter", null)
          .style("opacity", 1)
          .classed("candle-pattern-highlight", false);
      } else {
        this.#candlePatternActive = true;
        this.#highlightPatternCandles();
      }
    });

  }

  getChartMode() {
    return this.#chartMode;
  }

  getAnnotationsData() {
    return this.#annotationsData;
  }

  getObjectIDs() {
    return this.#objectIDs;
  }

  getChartMode() {
    return this.#chartMode;
  }

  getYScaleFunc() {
    return this.#yScaleFunc;
  }

  getXScaleFunc() {
    return this.#xScaleFunc;
  }

  getChartData() {
    return this.#filteredData;
  }


  setAnnotations(annotations) {
    this.#annotationsData = annotations;
  }

  toggleChartMode() {

    this.#chartMode = this.#chartMode === 'candlestick' ? 'line' : 'candlestick';
    this.draw();
    d3.select("#tools-btn-5")
      .html(this.#getChartTypeIcon());
  }



  async shareChartScreenshot() {
    const toolbar = document.getElementById(this.#objectIDs.toolsBtnsContainer);
    const dropdown = document.getElementById(`${this.#objectIDs.toolsBtnsContainer}-dropdown`);
    const card = toolbar?.closest(".stockChartCard");
    if (!card) return;

    // ── Show loader (same as your original) ──────────────────
    const loader = document.createElement("div");
    loader.id = "screenshot-loader";
    loader.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 999999;
      background: rgba(0,0,0,0.7);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
    `;
    loader.innerHTML = `
      <style>
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        #screenshot-loader .spinner {
          width: 44px; height: 44px;
          border: 3px solid rgba(255,255,255,0.1);
          border-top-color: #22d3ee;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          margin-bottom: 16px;
        }
        #screenshot-loader .label {
          color: #fff;
          font-size: 14px;
          font-family: sans-serif;
          font-weight: 500;
          animation: pulse 1.2s ease infinite;
          letter-spacing: 0.3px;
        }
      </style>
      <div class="spinner"></div>
      <div class="label">Capturing screenshot…</div>
    `;
    document.body.appendChild(loader);

    if (toolbar) toolbar.style.visibility = "hidden";
    if (dropdown) dropdown.style.visibility = "hidden";

    try {
      const blob = await toBlob(card, {
        backgroundColor: "#0b1220",
        pixelRatio: 2,
        filter: (node) => node.id !== "screenshot-loader",
      });

      if (!blob) throw new Error("toBlob returned null");

      const imageUrl = URL.createObjectURL(blob);
      this.#showShareModal(imageUrl, blob);

    } catch (err) {
      console.error("Capture failed:", err);
      this.#showToast("❌ Capture failed");
    } finally {
      if (toolbar) toolbar.style.visibility = "visible";
      if (dropdown) dropdown.style.visibility = "visible";
      loader.remove();
    }
  }
  #showShareModal(imageUrl, blob) {

    // ── Inject styles once ────────────────────────────────
    if (!document.getElementById("share-modal-styles")) {
      const style = document.createElement("style");
      style.id = "share-modal-styles";
      style.textContent = `
        @keyframes smFadeIn  { from{opacity:0}         to{opacity:1} }
        @keyframes smSlideUp { from{transform:translateY(24px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes teToastIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        .te-modal *{box-sizing:border-box;margin:0;padding:0;}
        .te-modal button{font-family:inherit;cursor:pointer;}
        .te-close-btn:hover{background:#1a3050!important;color:#e2f0ff!important;}
        .te-copy-btn:hover{background:#0ea5e9!important;}
        .te-dl-btn:hover{background:#1a3050!important;border-color:#2a4a70!important;color:#e2f0ff!important;}
        .te-social-btn:hover{background:#1a3050!important;border-color:#2a4a70!important;}
        .te-social-btn:hover svg{color:#22d3ee;}
      `;
      document.head.appendChild(style);
    }

    // ── Watermark: bottom-right corner ───────────────────
    const applyWatermark = (srcUrl) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0);

        // Professional watermark in bottom-right
        const padding = Math.max(20, c.width * 0.02);
        const fontSize = Math.max(16, c.width * 0.025);
        const text = "tradeye.in";
        
        ctx.font = `600 ${fontSize}px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";

        const x = c.width - padding;
        const y = c.height - padding;
        
        ctx.fillText(text, x, y);

        resolve(c.toDataURL("image/png"));
      };
      img.src = srcUrl;
    });

    // ── Build modal async after watermark ─────────────────
    applyWatermark(imageUrl).then((wmDataUrl) => {

      // Blob from watermarked dataUrl (for clipboard/share)
      const byteStr = atob(wmDataUrl.split(",")[1]);
      const ab = new ArrayBuffer(byteStr.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteStr.length; i++) ia[i] = byteStr.charCodeAt(i);
      const wmBlob = new Blob([ab], { type: "image/png" });

      // ── Helpers ───────────────────────────────────────────
      const div = (css = "") => { const el = document.createElement("div"); el.style.cssText = css; return el; };
      const btn = (css = "") => { const el = document.createElement("button"); el.style.cssText = css; return el; };
      const span = (txt, css = "") => { const el = document.createElement("span"); el.style.cssText = css; el.textContent = txt; return el; };

      // Share URL & caption
      const shareUrl = "https://tradeye.in";
      const directLink = `tradeye.in/t/caplipoint-${Date.now().toString().slice(-4)}`;
      const captionText = `📈Trade captured & analysed on tradeye.in\nBacktested. Scored. Tracked — all in one place.\n#trading #stockmarket #tradeye`;
      const encodedCap = encodeURIComponent(`📈 Trade captured & analysed on tradeye.in — Backtested. Scored. Tracked. #trading #tradeye`);
      const encodedUrl = encodeURIComponent(shareUrl);

      // ── Backdrop ──────────────────────────────────────────
      const backdrop = div(`
        position:fixed;inset:0;background:rgba(0,0,0,0.82);
        z-index:99998;display:flex;align-items:center;justify-content:center;
        animation:smFadeIn 0.2s ease;
      `);
      backdrop.className = "te-modal";

      // ── Modal ─────────────────────────────────────────────
      const modal = div(`
        background:#0d1b2a;border:1px solid #1a3050;border-radius:16px;
        width:500px;max-width:95vw;
        box-shadow:0 24px 64px rgba(0,0,0,0.75);
        animation:smSlideUp 0.25s ease;
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        overflow:hidden;
      `);

      // ── Header ────────────────────────────────────────────
      const header = div(`
        display:flex;align-items:center;justify-content:space-between;
        padding:16px 20px 14px;border-bottom:1px solid #1a3050;
      `);
      const titleWrap = div(`display:flex;align-items:center;gap:10px;`);
      const titleIcon = div(`
        width:30px;height:30px;background:#0ea5e9;border-radius:8px;
        display:flex;align-items:center;justify-content:center;flex-shrink:0;
      `);
      titleIcon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`;
      titleWrap.appendChild(titleIcon);
      titleWrap.appendChild(span("Share Your Trade", "color:#e2f0ff;font-size:15px;font-weight:600;letter-spacing:0.2px;"));
      const closeBtn = btn(`
        width:28px;height:28px;border-radius:6px;border:1px solid #1a3050;
        background:transparent;color:#5a7a99;display:flex;align-items:center;
        justify-content:center;transition:all 0.15s;flex-shrink:0;
      `);
      closeBtn.className = "te-close-btn";
      closeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
      header.appendChild(titleWrap);
      header.appendChild(closeBtn);

      // ── Preview ───────────────────────────────────────────
      const previewWrap = div(`padding:16px 20px 0;`);
      const previewImg = document.createElement("img");
      previewImg.src = wmDataUrl;
      previewImg.style.cssText = `width:100%;border-radius:10px;border:1px solid #1a3050;display:block;`;
      previewWrap.appendChild(previewImg);

      // ── Direct Link row ───────────────────────────────────
      const linkSection = div(`padding:14px 20px 0;`);
      const linkLabel = div(`font-size:11px;color:#3a5a79;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:8px;`);
      linkLabel.textContent = "Direct Link";
      const linkRow = div(`display:flex;gap:8px;`);

      const linkInput = document.createElement("input");
      linkInput.readOnly = true;
      linkInput.value = directLink;
      linkInput.style.cssText = `
        flex:1;background:#080f17;border:1px solid #1a3050;border-radius:8px;
        padding:10px 14px;font-size:13px;color:#6a8faa;font-family:inherit;outline:none;
        min-width:0;
      `;

      const copyLinkBtn = btn(`
        padding:10px 18px;border-radius:8px;border:none;
        background:#0ea5e9;color:#fff;font-size:13px;font-weight:600;
        display:flex;align-items:center;gap:6px;white-space:nowrap;transition:background 0.15s;
      `);
      copyLinkBtn.className = "te-copy-btn";
      copyLinkBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Copy Link`;
      copyLinkBtn.onclick = () => {
        navigator.clipboard.writeText(`https://${directLink}`).catch(() => { });
        showToast("Link copied!");
      };

      const dlBtn = btn(`
        padding:10px 16px;border-radius:8px;
        border:1px solid #1a3050;background:#0a1828;
        color:#a0bdd8;font-size:13px;font-weight:500;
        display:flex;align-items:center;gap:6px;white-space:nowrap;transition:all 0.15s;
      `);
      dlBtn.className = "te-dl-btn";
      dlBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download PNG`;
      dlBtn.onclick = () => {
        const a = document.createElement("a");
        a.href = wmDataUrl;
        a.download = `tradeye-${Date.now()}.png`;
        a.click();
        showToast("Downloaded!");
      };

      linkRow.appendChild(linkInput);
      linkRow.appendChild(copyLinkBtn);
      linkRow.appendChild(dlBtn);
      linkSection.appendChild(linkLabel);
      linkSection.appendChild(linkRow);

      // ── Caption box ───────────────────────────────────────
      const captionSection = div(`padding:14px 20px 0;`);
      const captionLabel = div(`font-size:11px;color:#3a5a79;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:8px;`);
      captionLabel.textContent = "Caption";
      const captionBox = div(`
        background:#080f17;border:1px solid #1a3050;border-radius:10px;
        padding:12px 14px;font-size:13px;color:#a0bdd8;line-height:1.65;
        white-space:pre-line;position:relative;
      `);
      captionBox.textContent = captionText;

      // Copy caption button inside box
      const copyCaptionBtn = btn(`
        position:absolute;top:10px;right:10px;
        background:transparent;border:1px solid #1a3050;border-radius:6px;
        padding:4px 8px;color:#3a5a79;font-size:11px;
        display:flex;align-items:center;gap:4px;transition:all 0.15s;
      `);
      copyCaptionBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
      copyCaptionBtn.onmouseenter = () => { copyCaptionBtn.style.background = "#1a3050"; copyCaptionBtn.style.color = "#e2f0ff"; };
      copyCaptionBtn.onmouseleave = () => { copyCaptionBtn.style.background = "transparent"; copyCaptionBtn.style.color = "#3a5a79"; };
      copyCaptionBtn.onclick = () => {
        navigator.clipboard.writeText(captionText).catch(() => { });
        showToast("Caption copied!");
      };
      captionBox.style.position = "relative";
      captionBox.appendChild(copyCaptionBtn);
      captionSection.appendChild(captionLabel);
      captionSection.appendChild(captionBox);

      // ── Share On (icon circles) ───────────────────────────
      const shareSection = div(`padding:16px 20px 20px;`);
      const shareLabel2 = div(`font-size:11px;color:#3a5a79;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:14px;text-align:center;`);
      shareLabel2.textContent = "Share On";
      const iconRow = div(`display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;`);

      const makeSocialBtn = (svgIcon, label, action) => {
        const b = btn(`
          width:48px;height:48px;border-radius:50%;
          border:1px solid #1a3050;background:#0a1828;
          display:flex;align-items:center;justify-content:center;
          transition:all 0.15s;color:#7a9bba;
        `);
        b.className = "te-social-btn";
        b.title = label;
        b.innerHTML = svgIcon;
        b.onclick = action;
        return b;
      };

      const socials = [
        {
          label: "Instagram",
          icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>`,
          action: () => {
            wmBlob && navigator.clipboard.write([new ClipboardItem({ "image/png": wmBlob })]).catch(() => { });
            showToast("Image copied — paste into Instagram!");
          },
        },
        {
          label: "X / Twitter",
          icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.845L1.254 2.25H8.08l4.261 5.632 5.903-5.632Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
          action: () => window.open(`https://twitter.com/intent/tweet?text=${encodedCap}&url=${encodedUrl}`, "_blank", "noopener"),
        },
        {
          label: "Discord",
          icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.098.248-.198.373-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>`,
          action: () => {
            wmBlob && navigator.clipboard.write([new ClipboardItem({ "image/png": wmBlob })]).catch(() => { });
            showToast("Copied — paste into Discord!");
          },
        },
        {
          label: "Telegram",
          icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>`,
          action: () => window.open(`https://t.me/share/url?url=${encodedUrl}&text=${encodedCap}`, "_blank", "noopener"),
        },
        {
          label: "WhatsApp",
          icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.121 1.535 5.856L.057 23.04c-.07.304.206.58.51.51l5.184-1.478A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.96 0-3.8-.527-5.382-1.442l-.386-.228-4.003 1.142 1.142-4.003-.228-.386A9.951 9.951 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>`,
          action: () => window.open(`https://wa.me/?text=${encodedCap}%20${encodedUrl}`, "_blank", "noopener"),
        },
      ];

      // Native mobile share as extra circle
      const mobileFile = new File([wmBlob], "tradeye-trade.png", { type: "image/png" });
      if (/iPhone|iPad|Android/i.test(navigator.userAgent) && navigator.canShare?.({ files: [mobileFile] })) {
        socials.unshift({
          label: "Share",
          icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,
          action: async () => {
            try { await navigator.share({ title: "My Trade on Tradeye", text: "📈 Trade captured & analysed on tradeye.in", files: [mobileFile] }); } catch { }
          },
        });
      }

      socials.forEach(({ icon, label, action }) => {
        iconRow.appendChild(makeSocialBtn(icon, label, action));
      });

      shareSection.appendChild(shareLabel2);
      shareSection.appendChild(iconRow);

      // ── Toast ─────────────────────────────────────────────
      const toast = div(`
        margin:0 20px 16px;background:rgba(34,211,238,0.08);
        border:1px solid rgba(34,211,238,0.2);border-radius:8px;
        padding:8px 12px;font-size:12px;color:#22d3ee;
        align-items:center;gap:6px;display:none;
      `);
      toast.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><span id="te-toast-msg"></span>`;

      let toastTimer;
      const showToast = (msg) => {
        document.getElementById("te-toast-msg").textContent = msg;
        toast.style.display = "flex";
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { toast.style.display = "none"; }, 2500);
      };

      // ── Assemble ──────────────────────────────────────────
      modal.appendChild(header);
      modal.appendChild(previewWrap);
      modal.appendChild(linkSection);
      modal.appendChild(captionSection);
      modal.appendChild(shareSection);
      modal.appendChild(toast);
      backdrop.appendChild(modal);
      document.body.appendChild(backdrop);

      // ── Close ─────────────────────────────────────────────
      const close = () => { backdrop.remove(); URL.revokeObjectURL(imageUrl); };
      closeBtn.onclick = close;
      backdrop.onclick = (e) => { if (e.target === backdrop) close(); };
    });
  }

  #showToast(message) {
    const existing = document.getElementById(`${this.id}-toast`);
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = `${this.id}-toast`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 32px;
      left: 50%;
      transform: translateX(-50%);
      background: #1e3a2f;
      color: #22d3ee;
      border: 1px solid #22d3ee;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 13px;
      font-family: sans-serif;
      z-index: 99999;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      opacity: 1;
      transition: opacity 0.4s ease;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 400);
    }, 2500);
  }


  #showUpgradeToast(feature) {
    d3.select(`#${this.id} .upgrade-toast`).remove();

    const isMobile = window.innerWidth <= 600;

    const toast = d3.select(`#${this.id}`)
      .append("div")
      .attr("class", "upgrade-toast")
      .style("position", "absolute")
      .style("top", "50%")
      .style("left", "50%")
      .style("transform", "translate(-50%, -50%)")
      .style("background", "#0a1628")
      .style("border", "1px solid rgba(59,130,246,0.25)")
      .style("border-radius", "5px")
      .style("padding", isMobile ? "20px 16px" : "24px 24px")
      .style("display", "flex")
      .style("flex-direction", "column")
      .style("align-items", "center")
      .style("gap", "16px")
      .style("z-index", "9999")
      .style("box-shadow", "0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(59,130,246,0.1)")
      .style("pointer-events", "auto")
      .style("width", isMobile ? "240px" : "280px")
      .style("box-sizing", "border-box");

    // Lock icon
    toast.append("div")
      .style("width", "40px")
      .style("height", "40px")
      .style("border-radius", "30%")
      .style("background", "rgba(59,130,246,0.10)")
      .style("border", "1px solid rgba(59,130,246,0.2)")
      .style("display", "flex")
      .style("align-items", "center")
      .style("justify-content", "center")
      .style("flex-shrink", "0")
      .html(`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>`);

    // Title
    toast.append("div")
      .style("color", "#ffffff")
      .style("font-size", "13px")
      .style("font-weight", "600")
      .style("font-family", "sans-serif")
      .style("text-align", "center")
      .style("line-height", "1.4")
      .style("width", "100%")
      .text("Stop entering at the wrong time");

    // Buttons row
    const btns = toast.append("div")
      .style("display", "flex")
      .style("gap", "8px")
      .style("width", "100%");

    btns.append("button")
      .style("flex", "1")
      .style("background", "transparent")
      .style("border", "1px solid #1e3048")
      .style("border-radius", "8px")
      .style("color", "#5a7a9a")
      .style("font-size", "12px")
      .style("font-family", "sans-serif")
      .style("padding", "9px 0")
      .style("cursor", "pointer")
      .style("white-space", "nowrap")
      .text("Dismiss")
      .on("click", () => toast.remove());

    btns.append("button")
      .style("flex", "1")
      .style("background", "#3b82f6")
      .style("border", "none")
      .style("border-radius", "8px")
      .style("color", "white")
      .style("font-size", "12px")
      .style("font-weight", "700")
      .style("font-family", "sans-serif")
      .style("padding", "9px 0")
      .style("cursor", "pointer")
      .style("white-space", "nowrap")
      .style("box-shadow", "0 0 16px rgba(59,130,246,0.35)")
      .text("Unlock ₹49/mo")
      .on("click", () => {
        window.location.href = "/pricing";
        toast.remove();
      });

    setTimeout(() => toast.remove(), 3000);
  }
  setData(newData) {
    this.data = newData;
    this.#filteredData = newData;
    this.#rsiData = this.#calculateRSI(14);
    this.destroy()
    this.draw();
  }

  #noop = () => { };

  #calculateInfoTextWidth() {
    this.#config.infoTextWidth =
      (this.#maxPrice.toFixed(this.#config.decimal).toString().length * 4 +
        11) *
      this.#config.charWidth;
  }

  #calculateInfoTextWidthMeta() {
    this.#config.infoTextWidthMeta =
      (this.#maxPrice.toFixed(this.#config.decimal).toString().length * 3 +
        14) *
      this.#config.charWidth;
  }

  #calculateYLabelWidth() {
    this.#config.yLabelWidth =
      2.4 +
      this.#maxPrice.toFixed(this.#config.decimal).toString().length *
      this.#config.charWidth;
  }

  #calculatePaddingRight() {
    this.#config.paddingRight = this.#config.yLabelWidth * 0.1;
  }

  #calculatePaddingLeft() {
    this.#config.paddingLeft = this.#config.xLabelWidth * 0.3;
  }

  #calculateSvgWidth() {
    this.#config.svgWidth =
      this.#config.width -
      (this.#config.paddingLeft + this.#config.paddingRight) -
      2;

  }

  #calculateSvgHeight() {
    const available = this.#config.height - (this.#config.paddingBottom + this.#config.paddingTop + 6);
    const { price, vol, rsi } = this.#getPanelRatios();

    this.#priceH = Math.floor(available * price) - (price < 1 ? this.#PANEL_GAP : 0);
    this.#volumeH = Math.floor(available * vol) - (vol > 0 ? this.#PANEL_GAP : 0);
    this.#rsiH = Math.floor(available * rsi);

    this.#volumeTop = this.#showVolume ? this.#priceH + this.#PANEL_GAP * 2 : 0;
    this.#rsiTop = this.#showRSI
      ? (this.#showVolume ? this.#volumeTop + this.#volumeH + this.#PANEL_GAP * 2 : this.#priceH + this.#PANEL_GAP * 2)
      : 0;

    this.#totalSvgH = this.#priceH
      + (this.#showVolume ? this.#volumeH + this.#PANEL_GAP * 2 : 0)
      + (this.#showRSI ? this.#rsiH + this.#PANEL_GAP * 2 : 0);

    this.#config.svgHeight = this.#priceH;
  }

  #getPanelRatios() {
    const hasVol = this.#showVolume;
    const hasRSI = this.#showRSI;

    if (hasVol && hasRSI) return { price: 0.70, vol: 0.15, rsi: 0.15 };
    if (hasVol && !hasRSI) return { price: 0.85, vol: 0.15, rsi: 0 };
    if (!hasVol && hasRSI) return { price: 0.85, vol: 0, rsi: 0.15 };
    return { price: 1.0, vol: 0, rsi: 0 };
  }

  #calculateXscale() {
    this.#xScaleFunc = d3
      .scaleTime()
      .domain([this.#zoomRange1, this.#zoomRange2])
      .range([0, this.#config.svgWidth]);
  }

  #calculateYscale() {

    let yMinMax;
    if (this.#filteredData.length === 0) {
      yMinMax = [0, 1];
    } else {
      const allValues = this.#filteredData.flatMap((x) =>
        [x.High, x.Low, x.sl, x.tp].filter((v) => v != null)
      );
      yMinMax = d3.extent(allValues).reverse();
      yMinMax[0] += yMinMax[0] * this.#config.yPaddingScaleTop;
      yMinMax[1] -= yMinMax[1] * this.#config.yPaddingScaleBottom;
    }

    this.#yScaleFunc = d3
      .scaleLinear()
      .domain(yMinMax)
      .range([0, this.#config.svgHeight]);

  }

  #calculateCandleWidth() {

    if (this.#filteredData.length === 0) {
      this.#candleLockerWidth = 0;
      this.#candleWidth = 0;
      return;
    }
    let minMax = d3.extent(this.#filteredData.map((x) => parseDate(x.Date)));
    this.#candleLockerWidth =
      this.#xScaleFunc(minMax[0].getTime() + this.#candleLockerWidthDate) -
      this.#xScaleFunc(minMax[0].getTime());

    this.#candleWidth = this.#candleLockerWidth - this.#candleLockerWidth * 0.3;
  }

  #calculateCandleWidthDate() {
    let times = this.#filteredData.map((x) => x.Date).sort();
    let indexes = [0, 1];
    let min = parseDate(times[1]) - parseDate(times[0]);
    for (let i = 1; i < times.length; i++) {
      if (parseDate(times[i + 1]) - parseDate(times[i]) < min) {
        min = parseDate(times[i + 1]) - parseDate(times[i]);
        indexes = [i, i + 1];
      }
    }

    let rWidth = parseDate(times[indexes[1]]) - parseDate(times[indexes[0]]);
    this.#candleLockerWidthDate = rWidth;
    rWidth -= rWidth * 0.3;
    this.#candleWidthDate = rWidth;
  }

  #calculateExtendConfigs() {

    this.#calculateInfoTextWidth();
    this.#calculateInfoTextWidthMeta();
    this.#calculateYLabelWidth();
    this.#calculatePaddingRight();
    this.#calculatePaddingLeft();
    this.#calculateSvgWidth();
    this.#calculateSvgHeight();
  }

  #setObjectIDs() {

    let randomNumber = (Math.random() * 10000).toFixed(0);
    this.#objectIDs = {};
    this.#objectIDs.svgId = `${this.id}-${randomNumber}`;
    this.#objectIDs.yAxisId = `yAxisG-${randomNumber}`;
    this.#objectIDs.xAxisId = `xAxisG-${randomNumber}`;
    this.#objectIDs.candleContainerId = `candles-${randomNumber}`;
    this.#objectIDs.xLineSelectorId = `xLineSelector-${randomNumber}`;
    this.#objectIDs.yLineSelectorId = `yLineSelector-${randomNumber}`;
    this.#objectIDs.xLabelSelectorId = `xLabelSelector-${randomNumber}`;
    this.#objectIDs.yLabelSelectorId = `yLabelSelector-${randomNumber}`;
    this.#objectIDs.candleInfoId = `candle-info-${randomNumber}`;
    this.#objectIDs.candleInfoIdBackground = `bc-candle-info-${randomNumber}`;
    this.#objectIDs.candleInfoIdPosition = `candle-info-${randomNumber}-position`;
    this.#objectIDs.candleInfoIdBackgroundPosition = `bc-candle-info-${randomNumber}-position`;
    this.#objectIDs.zoomBoxId1 = `zoom-box-${randomNumber}-1`;
    this.#objectIDs.zoomBoxId2 = `zoom-box-${randomNumber}-2`;
    this.#objectIDs.toolsBtnsContainer = `tools-btns-${randomNumber}`;
  }

  #createLayout() {
    const svg = d3.select(`#${this.id}`)
      .style('padding', `${this.#config.paddingTop}px ${this.#config.paddingRight}px ${this.#config.paddingBottom}px ${this.#config.paddingLeft}px`)
      .style('display', 'inline-block')
      .attr('width', this.#config.width)
      .attr('height', this.#config.height)
      .append('svg')
      .attr('width', this.#config.svgWidth)
      .attr('height', this.#totalSvgH)
      .style('overflow', 'inherit')
      .style('cursor', 'crosshair')
      .style('background-color', this.#colors.gridBackground)
      .attr('id', this.#objectIDs.svgId)
    // .style('margin-top', '-50px');

    const sepColor = this.#colors.grid || '#2a3a4a';

    // ── Volume panel separator + label (only if visible) ──
    if (this.#showVolume) {
      svg.append('line')
        .attr('class', 'panel-separator')
        .attr('x1', 0).attr('x2', this.#config.svgWidth)
        .attr('y1', this.#volumeTop - 1).attr('y2', this.#volumeTop - 1)
        .attr('stroke', sepColor).attr('stroke-width', 1).attr('opacity', 0.5);

      svg.append('text')
        .attr('class', 'panel-label')
        .attr('x', 6).attr('y', this.#volumeTop + 12)
        .attr('fill', this.#colors.tickColor || '#888')
        .attr('font-size', '10px').attr('font-weight', '600')
        .attr('font-family', 'monospace').text('VOL');
    }

    // ── RSI panel separator + label (only if visible) ─────
    if (this.#showRSI) {
      svg.append('line')
        .attr('class', 'panel-separator')
        .attr('x1', 0).attr('x2', this.#config.svgWidth)
        .attr('y1', this.#rsiTop - 1).attr('y2', this.#rsiTop - 1)
        .attr('stroke', sepColor).attr('stroke-width', 1).attr('opacity', 0.5);

      svg.append('text')
        .attr('class', 'panel-label')
        .attr('x', 6).attr('y', this.#rsiTop + 12)
        .attr('fill', this.#colors.tickColor || '#888')
        .attr('font-size', '10px').attr('font-weight', '600')
        .attr('font-family', 'monospace').text('RSI(14)');
    }
  }

  #createYaxis() {
    let yAxis = d3.axisRight(this.#yScaleFunc).tickSize(this.#config.svgWidth);
    d3.select(`#${this.#objectIDs.svgId}`)
      .append('g')
      .attr('id', this.#objectIDs.yAxisId)
      .call(yAxis);

    d3.selectAll(`#${this.#objectIDs.yAxisId} .domain`).each(function (d, i) {
      this.remove();
    });

    d3.selectAll(`#${this.#objectIDs.yAxisId}  g text`).attr(
      'transform',
      'translate(5,0)'
    );

    let gridColor = this.#colors.grid;
    d3.selectAll(`#${this.#objectIDs.yAxisId}  .tick line`).each(function (
      d,
      i
    ) {
      this.style.stroke = gridColor;
    });
    d3.selectAll(`#${this.#objectIDs.yAxisId} .tick text`).style(
      'fill',
      this.#colors.tickColor
    )
      .style('font-size', '10px')
      .style('font-weight', '600')

  }

  #createXaxis() {
    let xAxis = d3
      .axisBottom(this.#xScaleFunc)
      .ticks(this.#config.svgWidth / 100)
      .tickSize(this.#config.svgHeight); // only spans price panel

    d3.select(`#${this.#objectIDs.svgId}`)
      .append('g')
      .attr('id', this.#objectIDs.xAxisId)
      .call(xAxis);

    d3.selectAll(`#${this.#objectIDs.xAxisId} g text`).attr(
      'transform',
      'translate(0,10)'
    );

    let gridColor = this.#colors.grid;
    d3.selectAll(`#${this.#objectIDs.xAxisId} .tick line`).each(function (d, i) {
      this.style.stroke = gridColor;
    });
    d3.selectAll(`#${this.#objectIDs.xAxisId} .domain`).each(function (d, i) {
      this.remove();
    });
    d3.selectAll(`#${this.#objectIDs.xAxisId} .tick text`).style(
      'fill',
      this.#colors.tickColor
    ).style('font-size', '10px')
      .style('font-weight', '600');
  }

  #createInfoText() {

    d3.select(`#${this.#objectIDs.svgId}`)
      .append('rect')
      .attr('id', this.#objectIDs.candleInfoIdBackground)
      .attr('x', window.innerWidth > this.#config.mobileBreakPoint ? 20 : 0)
      .attr('y', window.innerWidth > this.#config.mobileBreakPoint ? 10 : 50)
      .attr('width', this.#config.infoTextWidth)
      .attr('height', 14)
      .attr('fill', this.#colors.background)
      .style('display', 'none');

    d3.select(`#${this.#objectIDs.svgId}`)
      .append('text')
      .attr('id', this.#objectIDs.candleInfoId)
      .style('font-size', '14px')
      .style('font-family', 'monospace')
      .attr('x', window.innerWidth > this.#config.mobileBreakPoint ? 20 : 0)
      .attr('y', window.innerWidth > this.#config.mobileBreakPoint ? 20 : 60)
      .style('fill', this.#colors.candleInfoText);

    d3.select(`#${this.#objectIDs.svgId}`)
      .append('rect')
      .attr('id', this.#objectIDs.candleInfoIdBackgroundPosition)
      .attr('x', window.innerWidth > this.#config.mobileBreakPoint ? 20 : 0)
      .attr('y', window.innerWidth > this.#config.mobileBreakPoint ? 30 : 70)
      .attr('width', this.#config.infoTextWidthMeta)
      .attr('height', 14)
      .attr('fill', this.#colors.background)
      .style('display', 'none');

    d3.select(`#${this.#objectIDs.svgId}`)
      .append('text')
      .attr('id', this.#objectIDs.candleInfoIdPosition)
      .style('font-size', '14px')
      .style('font-family', 'monospace')
      .attr('x', window.innerWidth > this.#config.mobileBreakPoint ? 20 : 0)
      .attr('y', window.innerWidth > this.#config.mobileBreakPoint ? 40 : 80)
      .style('fill', this.#colors.candleInfoText);
  }

  #createLockerGroup() {
    d3.select(`#${this.#objectIDs.svgId}`)
      .append('foreignObject')
      .attr('width', this.#config.svgWidth)
      .attr('height', this.#config.svgHeight)
      .selectAll()
      .data([1])
      .enter()
      .append('svg')
      .attr('id', this.#objectIDs.candleContainerId)
      .style('width', '100%')
      .style('height', '100%')
      .selectAll()
      .data(this.#filteredData)
      .enter()
      .append('g')
      .attr('class', 'candle-locker');
  }
  #createLockerBody() {
    d3.selectAll(`#${this.#objectIDs.candleContainerId} .candle-locker`)
      .append('rect')
      .attr('width', this.#candleLockerWidth)
      .attr('height', this.#config.svgHeight)
      .attr(
        'x',
        (d) => this.#xScaleFunc(parseDate(d.Date)) - this.#candleLockerWidth / 2
      )
      .attr('y', 0)
      .style('opacity', 0);
  }

  #createCandlesGroup() {
    d3.select(
      `#${this.#objectIDs.svgId} foreignObject #${this.#objectIDs.candleContainerId
      }`
    )
      .selectAll()
      .data(this.#filteredData)
      .enter()
      .append('g')
      .attr('class', 'candle');
  }


  #createCandlesBody() {
    const container = d3.selectAll(`#${this.#objectIDs.candleContainerId} .candle`);

    if (this.#chartMode === 'candlestick') {
      container
        .append('rect')
        .attr('width', this.#candleWidth)
        .attr('height', (d) =>
          d.Open > d.Close
            ? this.#yScaleFunc(d.Close) - this.#yScaleFunc(d.Open)
            : this.#yScaleFunc(d.Open) - this.#yScaleFunc(d.Close)
        )
        .attr(
          'x',
          (d) => this.#xScaleFunc(parseDate(d.Date)) - this.#candleWidth / 2
        )
        .attr('y', (d) =>
          d.Open > d.Close ? this.#yScaleFunc(d.Open) : this.#yScaleFunc(d.Close)
        )
        .attr('stroke', (d) =>
          d.Open > d.Close
            ? this.#colors.upCandlesStroke
            : this.#colors.downCandlesStroke
        )
        .attr('fill', (d) =>
          d.Open > d.Close
            ? this.#colors.upCandlesFill
            : this.#colors.downCandlesFill
        );

      // Remove any old line chart
      d3.selectAll(`#${this.#objectIDs.candleContainerId} .line-chart`).remove();

    } else if (this.#chartMode === 'line') {
      // Remove candle rects if switching to line mode
      container.selectAll('rect').remove();

      const lineData = container.data();

      const line = d3.line()
        .x(d => this.#xScaleFunc(parseDate(d.Date)))
        .y(d => this.#yScaleFunc(d.Close));

      d3.select(`#${this.#objectIDs.candleContainerId}`)
        .append('path')
        .attr('class', 'line-chart')
        .attr('fill', 'none')
        .attr('stroke', 'steelblue')
        .attr('stroke-width', 2)
        .attr('d', line(lineData));
    }
  }

  #createCandlesHigh() {
    if (this.#chartMode !== 'candlestick') return;

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .candle`)
      .append('rect')
      .attr('width', this.#config.candleTailWidth)
      .attr('height', (d) =>
        d.Open > d.Close
          ? this.#yScaleFunc(d.Open) - this.#yScaleFunc(d.High)
          : this.#yScaleFunc(d.Close) - this.#yScaleFunc(d.High)
      )
      .attr(
        'x',
        (d) =>
          this.#xScaleFunc(parseDate(d.Date)) - this.#config.candleTailWidth / 2
      )
      .attr('y', (d) => this.#yScaleFunc(d.High))
      .attr('fill', (d) =>
        d.Open > d.Close
          ? this.#colors.upCandlesTail
          : this.#colors.downCandlesTail
      );
  }

  #createCandlesLow() {
    if (this.#chartMode !== 'candlestick') return;

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .candle`)
      .append('rect')
      .attr('width', this.#config.candleTailWidth)
      .attr('height', (d) =>
        d.Open > d.Close
          ? this.#yScaleFunc(d.Low) - this.#yScaleFunc(d.Close)
          : this.#yScaleFunc(d.Low) - this.#yScaleFunc(d.Open)
      )
      .attr(
        'x',
        (d) =>
          this.#xScaleFunc(parseDate(d.Date)) - this.#config.candleTailWidth / 2
      )
      .attr('y', (d) =>
        d.Open > d.Close ? this.#yScaleFunc(d.Close) : this.#yScaleFunc(d.Open)
      )
      .attr('fill', (d) =>
        d.Open > d.Close
          ? this.#colors.upCandlesTail
          : this.#colors.downCandlesTail
      );
  }


  #getChartTypeIcon() {
    if (this.#chartMode === "line") {
      return "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M4 4v16'/><path d='M4 8h4v8H4'/><path d='M12 2v20'/><path d='M10 6h4v12h-4'/><path d='M20 4v16'/><path d='M18 10h4v4h-4'/></svg>";
    } else {
      return "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M3 3v18h18'/><path d='M19 9l-5 5-4-4-6 6'/></svg>";

    }
  }

  #calculateEMA(period) {

    const data = this.#filteredData;
    const closes = data.map(d => d.Close);
    const k = 2 / (period + 1);
    const ema = [];

    const seed = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
    ema.push({ Date: data[period - 1].Date, value: seed });

    for (let i = period; i < closes.length; i++) {
      const value = closes[i] * k + ema[ema.length - 1].value * (1 - k);
      ema.push({ Date: data[i].Date, value });
    }

    return ema;
  }

  #drawEMALines() {
    const svg = d3.select(`#${this.#objectIDs.svgId}`);
    svg.selectAll('.ema-line').remove();

    const emaColors = { 9: '#00bfff', 21: '#ffd700', 50: '#ff8c00', 200: '#ff4444' };
    const emas = [
      { period: 9, data: this.#ema9 },
      { period: 21, data: this.#ema21 },
      { period: 50, data: this.#ema50 },
      { period: 200, data: this.#ema200 },
    ];

    const line = d3.line()
      .x(d => this.#xScaleFunc(parseDate(d.Date)))
      .y(d => this.#yScaleFunc(d.value))
      .defined(d => d.value != null);

    emas.forEach(({ period, data }) => {
      if (!data || data.length === 0) return;

      svg.append('path')
        .attr('class', 'ema-line')
        .attr('fill', 'none')
        .attr('stroke', emaColors[period])
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.85)
        .attr('d', line(data));
    });
  }

  #drawSRLevels() {
    const svg = d3.select(`#${this.#objectIDs.svgId}`);
    svg.selectAll('.sr-level').remove();

    console.log("Drawing S/R levels:", this.#snrLevels);
    if (!this.#snrLevels || this.#snrLevels.length === 0) return;

    const xMin = this.#xScaleFunc(parseDate(this.#filteredData[0].Date));
    const xMax = this.#xScaleFunc(parseDate(this.#filteredData[this.#filteredData.length - 1].Date));

    // Get current price to determine support vs resistance
    const currentPrice = this.#filteredData[this.#filteredData.length - 1].Close;

    this.#snrLevels.forEach(price => {
      const y = this.#yScaleFunc(price);
      const isResistance = price > currentPrice;

      // Line
      svg.append('line')
        .attr('class', 'sr-level')
        .attr('x1', xMin)
        .attr('x2', xMax)
        .attr('y1', y)
        .attr('y2', y)
        .attr('stroke', isResistance ? '#ff4444' : '#00ff88')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4,3')
        .attr('opacity', 0.7);

      // Price label
      svg.append('text')
        .attr('class', 'sr-level')
        .attr('x', xMax + 6)
        .attr('y', y + 4)
        .attr('fill', isResistance ? '#ff4444' : '#00ff88')
        .attr('font-size', '11px')
        .attr('font-family', 'sans-serif')
        .text(price.toFixed(1));
    });
  }

  #highlightPatternCandles() {
    if (!this.#candlePattern?.patterns?.length) return;

    const self = this; // capture reference

    const patternDates = new Set(
      this.#candlePattern.patterns
        .filter(p => p.patterns?.length > 0 || p.score !== undefined)
        .map(p => new Date(p.trade_time).toDateString())
    );

    const pulseCandle = (selection) => {
      selection
        .transition()
        .duration(500)
        .style("opacity", 0.25)
        .transition()
        .duration(500)
        .style("opacity", 1)
        .on("end", function () {
          pulseCandle(d3.select(this));
        });
    };

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .candle`)
      .each(function (d) {  // keep regular function so `this` = DOM element
        const candleDate = new Date(d.Date).toDateString();
        if (patternDates.has(candleDate)) {
          const candle = d3.select(this); // `this` = the candle DOM element

          const match = self.#candlePattern.patterns.find(  // use `self` for class
            p => new Date(p.trade_time).toDateString() === candleDate
          );

          const score = match?.score ?? 50;
          const highlightColor = score >= 70 ? "#00ff88"
            : score >= 40 ? "#FFD700"
              : "#ff4444";

          candle.selectAll("rect")
            .classed("candle-pattern-highlight", true)
            .style("stroke", highlightColor)
            .style("stroke-width", "2px")
            .style("filter", `drop-shadow(0 0 4px ${highlightColor})`)
            .call(pulseCandle);
        }
      });
  }


  #drawVolumeChart() {
    const svg = d3.select(`#${this.#objectIDs.svgId}`);
    svg.selectAll('.volume-bar, .volume-axis, .volume-zero-line').remove();

    const data = this.#filteredData;
    if (!data || data.length === 0) return;

    const maxVolume = d3.max(data, d => d.Volume) || 1;
    const yVol = d3.scaleLinear()
      .domain([0, maxVolume])
      .range([this.#volumeTop + this.#volumeH, this.#volumeTop]);

    // Zero baseline
    svg.append('line')
      .attr('class', 'volume-zero-line')
      .attr('x1', 0).attr('x2', this.#config.svgWidth)
      .attr('y1', this.#volumeTop + this.#volumeH)
      .attr('y2', this.#volumeTop + this.#volumeH)
      .attr('stroke', this.#colors.grid || '#2a3a4a')
      .attr('stroke-width', 1);

    // Volume bars
    data.forEach(d => {
      const x = this.#xScaleFunc(parseDate(d.Date));
      const isGreen = d.Close >= d.Open;
      const barHeight = (this.#volumeTop + this.#volumeH) - yVol(d.Volume);
      const barW = Math.max(1, this.#candleWidth);

      svg.append('rect')
        .attr('class', 'volume-bar')
        .attr('x', x - barW / 2)
        .attr('y', yVol(d.Volume))
        .attr('width', barW)
        .attr('height', Math.max(0, barHeight))
        .attr('fill', isGreen ? '#26a69a' : '#ef5350')
        .attr('opacity', 0.7);
    });

    // Y axis for volume (right side, 2-3 ticks)
    const yVolAxis = d3.axisRight(yVol)
      .ticks(3)
      .tickSize(0)
      .tickFormat(d => d >= 1e6 ? `${(d / 1e6).toFixed(1)}M` : d >= 1e3 ? `${(d / 1e3).toFixed(0)}K` : d);

    svg.append('g')
      .attr('class', 'volume-axis')
      .attr('transform', `translate(${this.#config.svgWidth}, 0)`)
      .call(yVolAxis)
      .selectAll('text')
      .style('fill', this.#colors.tickColor || '#888')
      .style('font-size', '9px');

    svg.select('.volume-axis .domain').remove();
  }

  #calculateRSI(period = 14) {
    const data = this.data; // use full dataset for accurate RSI
    if (data.length < period + 1) return [];

    const closes = data.map(d => d.Close);
    const rsi = [];

    // Seed: first average gain/loss over `period` bars
    let avgGain = 0;
    let avgLoss = 0;
    for (let i = 1; i <= period; i++) {
      const change = closes[i] - closes[i - 1];
      if (change >= 0) avgGain += change;
      else avgLoss += Math.abs(change);
    }
    avgGain /= period;
    avgLoss /= period;

    const rs0 = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    rsi.push({ Date: data[period].Date, value: avgLoss === 0 ? 100 : 100 - 100 / (1 + rs0) });

    // Wilder smoothing
    for (let i = period + 1; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      const gain = change >= 0 ? change : 0;
      const loss = change < 0 ? Math.abs(change) : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
      rsi.push({ Date: data[i].Date, value: avgLoss === 0 ? 100 : 100 - 100 / (1 + rs) });
    }

    return rsi;
  }

  #drawRSIPanel() {
    const svg = d3.select(`#${this.#objectIDs.svgId}`);
    svg.selectAll('.rsi-element').remove();

    const rsiData = this.#rsiData.filter(d => {
      const t = parseDate(d.Date).getTime();
      return t >= this.#zoomRange1 && t <= this.#zoomRange2;
    });

    if (!rsiData || rsiData.length < 2) return;

    const panelTop = this.#rsiTop;
    const panelH = this.#rsiH;

    const yRsi = d3.scaleLinear()
      .domain([0, 100])
      .range([panelTop + panelH, panelTop]);

    // ── Overbought / Oversold zones ───────────────────────
    const zoneData = [
      { y1: 30, y2: 0, fill: 'rgba(38,166,154,0.08)' },  // oversold zone
      { y1: 100, y2: 70, fill: 'rgba(239,83,80,0.08)' },  // overbought zone
    ];
    zoneData.forEach(z => {
      svg.append('rect')
        .attr('class', 'rsi-element')
        .attr('x', 0)
        .attr('y', yRsi(z.y1))
        .attr('width', this.#config.svgWidth)
        .attr('height', yRsi(z.y2) - yRsi(z.y1))
        .attr('fill', z.fill);
    });

    // ── Reference lines at 70, 50, 30 ───────────────────
    [70, 50, 30].forEach(level => {
      const y = yRsi(level);
      svg.append('line')
        .attr('class', 'rsi-element')
        .attr('x1', 0).attr('x2', this.#config.svgWidth)
        .attr('y1', y).attr('y2', y)
        .attr('stroke', level === 50 ? (this.#colors.grid || '#2a3a4a') : (level === 70 ? '#ef5350' : '#26a69a'))
        .attr('stroke-width', level === 50 ? 1 : 0.8)
        .attr('stroke-dasharray', level === 50 ? '3,3' : '4,2')
        .attr('opacity', 0.6);

      svg.append('text')
        .attr('class', 'rsi-element')
        .attr('x', this.#config.svgWidth + 3)
        .attr('y', y + 3)
        .attr('fill', level === 70 ? '#ef5350' : level === 30 ? '#26a69a' : (this.#colors.tickColor || '#888'))
        .attr('font-size', '9px')
        .text(level);
    });

    // ── RSI line ──────────────────────────────────────────
    const line = d3.line()
      .x(d => this.#xScaleFunc(parseDate(d.Date)))
      .y(d => yRsi(d.value))
      .defined(d => d.value != null)
      .curve(d3.curveMonotoneX);

    svg.append('path')
      .attr('class', 'rsi-element')
      .attr('fill', 'none')
      .attr('stroke', '#b388ff')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.9)
      .attr('d', line(rsiData));

    // ── Current RSI value label ───────────────────────────
    const lastRsi = rsiData[rsiData.length - 1];
    if (lastRsi) {
      const rsiColor = lastRsi.value >= 70 ? '#ef5350' : lastRsi.value <= 30 ? '#26a69a' : '#b388ff';
      svg.append('text')
        .attr('class', 'rsi-element')
        .attr('x', this.#config.svgWidth + 3)
        .attr('y', yRsi(lastRsi.value) + 3)
        .attr('fill', rsiColor)
        .attr('font-size', '9px')
        .attr('font-weight', '700')
        .text(lastRsi.value.toFixed(1));
    }

    // ── Y axis ────────────────────────────────────────────
    const yRsiAxis = d3.axisRight(yRsi)
      .tickValues([30, 50, 70])
      .tickSize(0);

    svg.append('g')
      .attr('class', 'rsi-element')
      .attr('transform', `translate(${this.#config.svgWidth}, 0)`)
      .call(yRsiAxis)
      .selectAll('text').remove(); // labels already drawn above

    svg.select('.rsi-element.domain').remove();
  }

  #createToolsBtns() {
    createToolsBtns({
      id: this.id,
      objectIDs: this.#objectIDs,
      getChartTypeIcon: () => this.#getChartTypeIcon(),
      isPaid: this.#isPaid
    });
  }

  async #fetchSRLevels() {
    try {
      const res = await axios.post(
        `${ENV.BASE_API_URL}/api/sr-levels/`,
        {
          candles: this.#filteredData,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
          },
        }
      );
      console.log("SR Levels:", res.data);
      this.#snrLevels = res.data.lines;
      this.#drawSRLevels();
    } catch (err) {
      console.error("SR Levels fetch error:", err);
    } finally {
      this.#srLevelsFetching = false;
    }
  }

  async #fetchCandlePattern() {
    try {
      const res = await axios.post(
        `${ENV.BASE_API_URL}/api/candle-pattern/`,
        {
          candles: this.#filteredData,
          trade_data: this.#annotationsData.map(a => ({
            date: a.Date,
            trade_type: a.transactionType
          })),
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
          },
        }
      );
      console.log("Candle Pattern:", res.data);
      this.#candlePattern = res.data;
    } catch (err) {
      console.error("Candle Pattern fetch error:", err);
    } finally {
      this.#candlePatternFetching = false;
    }
  }

  #modeHandler(mode) {

    this.#mode = mode;

    const btn0 = `#${this.#objectIDs.toolsBtnsContainer} #tools-btn-0`;
    const btn1 = `#${this.#objectIDs.toolsBtnsContainer} #tools-btn-1`;
    const btn2 = `#${this.#objectIDs.toolsBtnsContainer} #tools-btn-2`;
    const btn3 = `#${this.#objectIDs.toolsBtnsContainer} #tools-btn-3`;
    const btn4 = `#${this.#objectIDs.toolsBtnsContainer} #tools-btn-4`;
    const btn5 = `#${this.#objectIDs.toolsBtnsContainer} #tools-btn-5`;
    const btn6 = `#${this.#objectIDs.toolsBtnsContainer} #tools-btn-6`;

    // 🆕 Updated: Added btn4 in reset loop
    [btn0, btn1, btn2, btn3, btn4, btn5, btn6].forEach((selector) => {
      if (!document.querySelector(selector)) return;
      const svg = document.querySelector(`${selector} svg g g`) || document.querySelector(`${selector} svg`);
      svg?.setAttribute('fill', this.#colors.deActiveTools);
      d3.select(selector).style('border', `1px solid ${this.#colors.deActiveTools}`);
    });

    const activeBtn = {
      pan: btn2,
      zoom: btn1,
      draw: btn3,
      measure: btn4,
    }[mode];

    const activeSVG = document.querySelector(`${activeBtn} svg g g`) || document.querySelector(`${activeBtn} svg`);
    activeSVG?.setAttribute('fill', this.#colors.activeTools);
    d3.select(activeBtn).style('border', `1px solid ${this.#colors.activeTools}`);

  }


  #handleResetZoom() {
    this.#zoomRange1 =
      this.#minMaxDate[0].getTime() - this.#candleWidthDate / 2;

    // this.#zoomRange2 =
    //   this.#minMaxDate[1].getTime() + this.#candleWidthDate / 2;

    const totalRange =
      this.#minMaxDate[1].getTime() - this.#minMaxDate[0].getTime();

    this.#zoomRange2 =
      this.#minMaxDate[1].getTime() + totalRange * this.#rightOffsetFactor;


    this.#filteredData = this.data;
    this.#zoomFactor = 1;
    this.#removeAllLines();
    this.draw();
  }

  #xLineHandler(d, position) {
    let xPosition;
    if (position) xPosition = position;
    else xPosition = this.#xScaleFunc(parseDate(d.Date));

    let xLine = document.getElementById(this.#objectIDs.xLineSelectorId);

    if (xLine) {
      d3.select(xLine)
        .attr('x1', xPosition)
        .attr('y1', 0)
        .attr('x2', xPosition)
        .attr('y2', this.#config.svgHeight);
    } else {
      d3.select(`#${this.#objectIDs.svgId}`)
        .insert('line', `#${this.#objectIDs.xAxisId}`)
        .attr('id', this.#objectIDs.xLineSelectorId)
        .attr('stroke', this.#colors.selectorLine)
        .attr('stroke-dasharray', this.#config.selectoreStrokeDashArray)
        .attr('x1', xPosition)
        .attr('y1', 0)
        .attr('x2', xPosition)
        .attr('y2', this.#config.svgHeight);
    }
  }

  #xLabelHandler(d, position) {
    let xPosition;
    if (position) xPosition = position;
    else xPosition = this.#xScaleFunc(parseDate(d.Date));

    let xLabel = document.getElementById(this.#objectIDs.xLabelSelectorId);
    if (xLabel) {
      d3.select(xLabel).attr(
        'transform',
        `translate(
      ${xPosition >= this.#config.svgWidth - this.#config.xLabelWidth / 2
          ? this.#config.svgWidth - this.#config.xLabelWidth
          : xPosition <= this.#config.xLabelWidth / 2
            ? 0
            : xPosition - this.#config.xLabelWidth / 2
        },${this.#config.svgHeight})`
      );
      document.querySelector(
        `#${this.#objectIDs.xLabelSelectorId} text`
      ).innerHTML = d3.timeFormat(this.#config.timeFormat)(
        this.#xScaleFunc.invert(xPosition)
      );
    } else {
      d3.select(`#${this.#objectIDs.svgId}`)
        .append('g')
        .attr('id', this.#objectIDs.xLabelSelectorId)
        .attr(
          'transform',
          `translate(
          ${xPosition >= this.#config.svgWidth - this.#config.xLabelWidth / 2
            ? this.#config.svgWidth - this.#config.xLabelWidth
            : xPosition <= this.#config.xLabelWidth / 2
              ? 0
              : xPosition - this.#config.xLabelWidth / 2
          },${this.#config.svgHeight})`
        );

      d3.select(`#${this.#objectIDs.xLabelSelectorId}`)
        .append('rect')
        .attr('fill', this.#colors.selectorLableBackground)
        .attr('width', this.#config.xLabelWidth)
        .attr('height', this.#config.xLabelHeight);

      d3.select(`#${this.#objectIDs.xLabelSelectorId}`)
        .append('text')
        .style('font-size', `${this.#config.xLabelFontSize}px`)
        .attr('fill', this.#colors.selectorLabelText)
        .style('font-family', 'monospace')
        .attr('x', 10)
        .attr('y', 15);

      document.querySelector(
        `#${this.#objectIDs.xLabelSelectorId} text`
      ).innerHTML = d3.timeFormat(this.#config.timeFormat)(
        this.#xScaleFunc.invert(xPosition)
      );
    }
  }

  #yLineHandler(d, position) {
    let yLine = document.getElementById(this.#objectIDs.yLineSelectorId);
    if (yLine) {
      d3.select(yLine)
        .attr('x1', 0)
        .attr('y1', position)
        .attr('x2', this.#config.svgWidth)
        .attr('y2', position);
    } else {
      d3.select(`#${this.#objectIDs.svgId}`)
        .insert('line', `#${this.#objectIDs.xAxisId}`)
        .attr('id', this.#objectIDs.yLineSelectorId)
        .attr('stroke', this.#colors.selectorLine)
        .attr('stroke-dasharray', this.#config.selectoreStrokeDashArray)
        .attr('x1', 0)
        .attr('y1', position)
        .attr('x2', this.#config.svgHeight)
        .attr('y2', position);
    }
  }

  #yLabelHandler(d, position) {
    let yLabel = document.getElementById(this.#objectIDs.yLabelSelectorId);
    if (yLabel) {
      d3.select(yLabel).attr(
        'transform',
        `translate(${this.#config.svgWidth},
        ${position >= this.#config.svgHeight - this.#config.yLabelHeight / 2
          ? this.#config.svgHeight - this.#config.yLabelHeight
          : position <= this.#config.yLabelHeight / 2
            ? 0
            : position - this.#config.yLabelHeight / 2
        })`
      );
      document.querySelector(
        `#${this.#objectIDs.yLabelSelectorId} text`
      ).innerHTML = this.#yScaleFunc
        .invert(position)
        .toFixed(this.#config.decimal);
    } else {
      d3.select(`#${this.#objectIDs.svgId}`)
        .append('g')
        .attr('id', this.#objectIDs.yLabelSelectorId)
        .attr(
          'transform',
          `translate(${this.#config.svgWidth},
            ${position >= this.#config.svgHeight - this.#config.yLabelHeight / 2
            ? this.#config.svgHeight - this.#config.yLabelHeight
            : position <= this.#config.yLabelHeight / 2
              ? 0
              : position - this.#config.yLabelHeight / 2
          })`
        );

      d3.select(`#${this.#objectIDs.yLabelSelectorId}`)
        .append('rect')
        .attr('fill', this.#colors.selectorLableBackground)
        .attr('width', this.#config.yLabelWidth)
        .attr('height', this.#config.yLabelHeight);

      d3.select(`#${this.#objectIDs.yLabelSelectorId}`)
        .append('text')
        .style('font-size', `${this.#config.yLabelFontSize}px`)
        .attr('fill', this.#colors.selectorLabelText)
        .style('font-family', 'monospace')
        .attr('x', 5)
        .attr('y', 15);

      document.querySelector(
        `#${this.#objectIDs.yLabelSelectorId} text`
      ).innerHTML = this.#yScaleFunc.invert(position).toFixed(1);
    }
  }

  #candleInfoHandler(d) {

    if (this.#chartMode == 'line') return;

    let isUp = d.Open > d.Close;
    document.getElementById(this.#objectIDs.candleInfoId).innerHTML = `
    O <tspan style='fill:${isUp ? this.#colors.candleInfoTextUp : this.#colors.candleInfoTextDown
      }'>${d.Open.toFixed(this.#config.decimal)}</tspan> 
    H <tspan style='fill:${isUp ? this.#colors.candleInfoTextUp : this.#colors.candleInfoTextDown
      }'>${d.High.toFixed(this.#config.decimal)}</tspan> 
    L <tspan style='fill:${isUp ? this.#colors.candleInfoTextUp : this.#colors.candleInfoTextDown
      }'>${d.Low.toFixed(this.#config.decimal)}</tspan> 
    C <tspan style='fill:${isUp ? this.#colors.candleInfoTextUp : this.#colors.candleInfoTextDown
      }'>${d.Close.toFixed(this.#config.decimal)}</tspan>`;
    document.getElementById(
      this.#objectIDs.candleInfoIdBackground
    ).style.display = 'block';

    if (d.long || d.short) {
      let text = '';
      if (d.long) {
        text = `Long <tspan style='fill:${this.#colors.long}'> ${d.long.toFixed(
          this.#config.decimal
        )}</tspan>`;
      } else {
        text = `Short <tspan style='fill:${this.#colors.short
          }'> ${d.short.toFixed(this.#config.decimal)}</tspan>`;
      }
      text += ` SL <tspan style='fill:${this.#colors.sl}'> ${d.sl.toFixed(
        this.#config.decimal
      )}</tspan>`;
      text += ` TP <tspan style='fill:${this.#colors.tp}'> ${d.tp.toFixed(
        this.#config.decimal
      )}</tspan>`;

      document.getElementById(this.#objectIDs.candleInfoIdPosition).innerHTML =
        text;
      document.getElementById(
        this.#objectIDs.candleInfoIdBackgroundPosition
      ).style.display = 'block';
    }
  }

  #candleInfoLeaveHandler() {
    document.getElementById(this.#objectIDs.candleInfoId).innerHTML = ``;
    document.getElementById(
      this.#objectIDs.candleInfoIdBackground
    ).style.display = 'none';

    document.getElementById(
      this.#objectIDs.candleInfoIdPosition
    ).innerHTML = ``;
    document.getElementById(
      this.#objectIDs.candleInfoIdBackgroundPosition
    ).style.display = 'none';
  }

  #initPatternTooltip() {
    // Remove if exists
    d3.select(`#${this.id} .pattern-tooltip`).remove();

    d3.select(`#${this.id}`)
      .append("div")
      .attr("class", "pattern-tooltip")
      .style("position", "absolute")
      .style("display", "none")
      .style("background", "#0d1b2a")
      .style("border", "1px solid #1e3048")
      .style("border-radius", "8px")
      .style("padding", "10px 14px")
      .style("pointer-events", "none")
      .style("z-index", "9999")
      .style("font-size", "12px")
      .style("font-family", "sans-serif")
      .style("box-shadow", "0 4px 16px rgba(0,0,0,0.5)")
      .style("max-width", "220px")
      .style("line-height", "1.8");
  }

  #mouseMoveLockers(d, event) {
    this.#lockSelectorX = true;
    this.#xLineHandler(d);
    this.#xLabelHandler(d);
    this.#candleInfoHandler(d);

    // Pattern tooltip
    if (this.#candlePatternActive && this.#candlePattern?.patterns?.length) {
      const candleDate = new Date(d.Date).toDateString();
      const match = this.#candlePattern.patterns.find(
        p => new Date(p.trade_time).toDateString() === candleDate
      );

      if (match) {
        const score = match.score ?? 50;
        const scoreColor = score >= 70 ? "#00ff88"
          : score >= 40 ? "#FFD700"
            : "#ff4444";

        const patternNames = match.patterns?.length
          ? match.patterns.map(p => `<span style="color:${scoreColor}">${p}</span>`).join(", ")
          : `<span style="color:#aaa">No named pattern</span>`;

        const tooltip = d3.select(`#${this.id} .pattern-tooltip`);
        tooltip
          .style("display", "block")
          .html(`
          <div style="color:#fff; font-weight:600; margin-bottom:4px;">
            Candle Pattern
          </div>
          <div style="color:#aaa; margin-bottom:6px; font-size:11px;">
            ${match.description ?? ""}
          </div>
          <div style="margin-bottom:4px;">${patternNames}</div>
          <div style="margin-top:6px; border-top:1px solid #1e3048; padding-top:6px;">
            Score: <span style="color:${scoreColor}; font-weight:700; font-size:14px;">
              ${score}/100
            </span>
          </div>
        `);

        // Position near the candle
        const chartRect = document.getElementById(this.id).getBoundingClientRect();
        const x = this.#xScaleFunc(parseDate(d.Date));
        const y = this.#yScaleFunc(d.High);

        tooltip
          .style("left", `${x + 50}px`)
          .style("top", `${y - 10}px`);

      } else {
        d3.select(`#${this.id} .pattern-tooltip`).style("display", "none");
      }
    }
  }

  #mouseLeaveLocker(d) {
    this.#lockSelectorX = false;
    this.#candleInfoLeaveHandler();
    d3.select(`#${this.id} .pattern-tooltip`).style("display", "none");
  }

  #handleZoomBox() {

    let zoomBox1 = document.querySelector(`#${this.#objectIDs.zoomBoxId1}`);
    if (zoomBox1) zoomBox1.remove();

    let zoomBox2 = document.querySelector(`#${this.#objectIDs.zoomBoxId2}`);
    if (zoomBox2) zoomBox2.remove();

    let height = document.getElementById(`${this.#objectIDs.candleContainerId}`)
      .height.baseVal.value;
    let width = document.getElementById(`${this.#objectIDs.candleContainerId}`)
      .width.baseVal.value;

    d3.select(`#${this.#objectIDs.candleContainerId}`)
      .selectAll()
      .data([0])
      .enter()
      .append('rect')
      .attr('id', this.#objectIDs.zoomBoxId1)
      .attr(
        'width',
        this.#zoomPoint2 > this.#zoomPoint1
          ? this.#zoomPoint1
          : this.#zoomPoint2
      )
      .attr('x', 0)
      .attr('y', 0)
      .attr('height', height)
      .attr('fill', 'black')
      .attr('stroke', 'none')
      .style('opacity', 0.5);

    d3.select(`#${this.#objectIDs.candleContainerId}`)
      .selectAll()
      .data([0])
      .enter()
      .append('rect')
      .attr('id', this.#objectIDs.zoomBoxId2)
      .attr('width', width - this.#zoomPoint2)
      .attr(
        'x',
        this.#zoomPoint2 > this.#zoomPoint1
          ? this.#zoomPoint2
          : this.#zoomPoint1
      )
      .attr('y', 0)
      .attr('height', height)
      .attr('fill', 'black')
      .attr('stroke', 'none')
      .style('opacity', 0.5);

  }

  #handleZoom() {
    let zoomBox1 = document.querySelector(`#${this.#objectIDs.zoomBoxId1}`);
    if (zoomBox1) zoomBox1.remove();

    let zoomBox2 = document.querySelector(`#${this.#objectIDs.zoomBoxId2}`);
    if (zoomBox2) zoomBox2.remove();

    let minMaxZoom = d3.extent([this.#zoomPoint1, this.#zoomPoint2]);

    let leftDate = parseDate(this.#xScaleFunc.invert(minMaxZoom[0]));
    let rightDate = parseDate(this.#xScaleFunc.invert(minMaxZoom[1]));

    if (leftDate - rightDate === 0) {
      return;
    }

    let filteredData = this.data.filter((x) => {
      return (
        parseDate(x.Date).getTime() >
        leftDate.getTime() - this.#candleWidthDate &&
        parseDate(x.Date).getTime() <
        rightDate.getTime() + this.#candleWidthDate
      );
    });

    let oldZoomRange1 = this.#minMaxDate[0];
    let oldZoomRange2 = this.#minMaxDate[1];

    let newZoomRange1 = parseDate(this.#xScaleFunc.invert(minMaxZoom[0]));
    let newZoomRange2 = parseDate(this.#xScaleFunc.invert(minMaxZoom[1]));

    this.#zoomFactor =
      (oldZoomRange2 - oldZoomRange1) / (newZoomRange2 - newZoomRange1);

    this.#zoomRange1 = newZoomRange1;
    this.#zoomRange2 = newZoomRange2;

    this.#filteredData = filteredData;
    this.#mode = 'pan';
    this.draw();
  }

  #handlePan(location) {
    let dateWidth = this.#zoomRange2 - this.#zoomRange1;
    let width = document.getElementById(`${this.#objectIDs.candleContainerId}`)
      .width.baseVal.value;

    let fraction = location / width;

    let newZoomRange1 = this.#panTargetDate - fraction * dateWidth;
    let newZoomRange2 = newZoomRange1 + dateWidth;

    let filteredData = this.data.filter((x) => {
      return (
        parseDate(x.Date).getTime() > newZoomRange1 - this.#candleWidthDate &&
        parseDate(x.Date).getTime() < newZoomRange2 + this.#candleWidthDate
      );
    });

    this.#zoomRange1 = newZoomRange1;
    this.#zoomRange2 = newZoomRange2;

    this.#filteredData = filteredData;
    this.draw();
  }

  #handleDrawLine(location) {

    if (this.#mode !== 'draw' || this.#drawAndMeasureLocked) return;

    const svg = d3.select(`#${this.#objectIDs.svgId}`);

    if (!this.#drawPoint1) {
      this.#drawPoint1 = location;

      this.#tempLine = svg.append('line')
        .attr('x1', location.x)
        .attr('y1', location.y)
        .attr('x2', location.x)
        .attr('y2', location.y)
        .attr('stroke', this.#colors.lineColor)
        .attr('stroke-width', 1.5);
    } else {

      this.#drawPoint2 = { x: location.x, y: location.y };

      const lineData = {
        x1: this.#xScaleFunc.invert(this.#drawPoint1.x),
        y1: this.#yScaleFunc.invert(this.#drawPoint1.y),
        x2: this.#xScaleFunc.invert(this.#drawPoint2.x),
        y2: this.#yScaleFunc.invert(this.#drawPoint2.y),
      };
      this.#lineData.push(lineData);

      svg.append('line')
        .attr('x1', this.#drawPoint1.x)
        .attr('y1', this.#drawPoint1.y)
        .attr('x2', this.#drawPoint2.x)
        .attr('y2', this.#drawPoint2.y)
        .attr('stroke', this.#colors.lineColor)
        .attr('stroke-width', 1.5);

      // Remove temp line
      if (this.#tempLine) {
        this.#tempLine.remove();
      }

      requestAnimationFrame(() => {
        this.#drawPoint1 = null;
        this.#drawPoint2 = null;
        this.#tempLine = null;
        this.#drawAndMeasureLocked = false;
        this.#mode = 'pan';
      });

    }
  }

  #redrawCachedLines() {

    const svg = d3.select(`#${this.#objectIDs.svgId}`);

    svg.selectAll('.line').remove();

    d3.select(`#${this.#objectIDs.svgId}`)
      .selectAll('.user-line')
      .data(this.#lineData)
      .enter()
      .append('line')
      .attr('class', 'user-line')
      .attr('x1', d => this.#xScaleFunc(d.x1))
      .attr('y1', d => this.#yScaleFunc(d.y1))
      .attr('x2', d => this.#xScaleFunc(d.x2))
      .attr('y2', d => this.#yScaleFunc(d.y2))
      .attr('stroke', this.#colors.lineColor)
      .attr('stroke-width', 1.5);
  }

  #removeAllLines() {

    const svg = d3.select(`#${this.#objectIDs.svgId}`);
    svg.selectAll('user-line').remove();
    this.#lineData = [];
  }


  #handleMeasure(location) {

    if (this.#mode !== 'measure' || this.#drawAndMeasureLocked) return;

    const svg = d3.select(`#${this.#objectIDs.svgId}`);

    if (!this.#measureState.start) {
      svg.selectAll('.measure-rect').remove();
      svg.selectAll('.measure-label').remove();

      this.#measureState.start = location;

      this.#measureState.rect = svg.append('rect')
        .attr('class', 'measure-rect')
        .attr('x', location.x)
        .attr('y', location.y)
        .attr('width', 0)
        .attr('height', 0)
        .attr('fill', 'rgba(0,255,0,0.2)')
        .attr('stroke', 'lime')
        .attr('stroke-width', 1);

      this.#measureState.label = svg.append('text')
        .attr('class', 'measure-label')
        .attr('x', location.x)
        .attr('y', location.y - 8)
        .attr('fill', 'white')
        .attr('font-size', '12px');

      d3.select(`#${this.#objectIDs.svgId}`)
        .on('mousemove.measure', (event) => {
          const current = getCursorPoint(this.#objectIDs.svgId, event);
          if (!this.#drawAndMeasureLocked) {
            this.#updateMeasureBox(current);
          }
        });

    } else {

      this.#drawAndMeasureLocked = true;
      d3.select(`#${this.#objectIDs.svgId}`).on('mousemove.measure', null);

      this.#measureState.start = null;
      this.#measureState.rect = null;
      this.#measureState.label = null;
      this.#drawAndMeasureLocked = false;
      this.#mode = 'pan';
    }
  }

  #updateMeasureBox(current) {

    const { start, rect, label } = this.#measureState;

    const x = Math.min(start.x, current.x);
    const y = Math.min(start.y, current.y);
    const width = Math.abs(current.x - start.x);
    const height = Math.abs(current.y - start.y);

    rect.attr('x', x).attr('y', y).attr('width', width).attr('height', height);

    const priceA = this.#yScaleFunc.invert(start.y);
    const priceB = this.#yScaleFunc.invert(current.y);
    const diff = priceB - priceA;
    const percent = ((diff / priceA) * 100).toFixed(2);

    const fillColor = priceB > priceA ? 'rgba(0,255,0,0.2)' : 'rgba(255,0,0,0.2)';
    const strokeColor = priceB > priceA ? 'lime' : 'red';

    rect.attr('x', x)
      .attr('y', y)
      .attr('width', width)
      .attr('height', height)
      .attr('fill', fillColor)
      .attr('stroke', strokeColor);

    // 🔥 Get time-based data
    const timeA = this.#xScaleFunc.invert(start.x);
    const timeB = this.#xScaleFunc.invert(current.x);
    const bars = this.#filteredData.filter(d => {
      const date = new Date(d.Date);
      return date >= timeA && date <= timeB || date >= timeB && date <= timeA;
    });

    const numBars = bars.length;
    const numDays = Math.abs((timeB - timeA) / (1000 * 60 * 60 * 24)).toFixed(1);

    label
      .attr('x', x + width / 2)
      .attr('y', y - 8)
      .text(`${diff.toFixed(2)} (${percent}%) | ${numBars} bars | ${numDays} days`);
  }


  #drawStaticAnnotationFromData() {
    const data = this.#annotationsData;
    if (!data?.length) return;

    const parseTime = d => new Date(d);
    const formatTime = d3.timeFormat("%Y-%m-%d");

    const customType = annotationCustomType(annotationCalloutCurve, {
      className: "custom",
      connector: {
        type: "elbow",
        end: "arrow",
      },
      note: {
        align: "middle",
        wrap: 400,
        lineType: null,
        line: []
      }
    });

    const tempPlacedBoxes = [];
    const isMobile = this.#config.svgWidth < this.#config.mobileBreakPoint;
    const makeAnnotation = annotation()
      .editMode(true)
      .notePadding(15)
      .type(customType)
      .accessors({
        x: d => this.#xScaleFunc(parseTime(d.Date)),
        y: d => this.#yScaleFunc(d.Close)
      })
      .accessorsInverse({
        Date: d => formatTime(this.#xScaleFunc.invert(d.x)),
        Close: d => this.#yScaleFunc.invert(d.y)
      })
      .annotations(
        data.map(d => {

          const override = this.#annotationCache.get(d.id) || {};

          let dx, dy;
          if (override.dx !== undefined) {
            dx = override.dx;
            dy = override.dy;
          } else {
            // base offsets
            dx = d.transactionType === "buy" ? (isMobile ? -80 : -150) : (isMobile ? 80 : 150);
            dy = d.transactionType === "buy" ? (isMobile ? 30 : 50) : (isMobile ? -30 : -50);

            // get anchor position on chart
            const ax = this.#xScaleFunc(parseTime(d.Date));
            const ay = this.#yScaleFunc(d.Close);

            // resolve overlap with previous annotations
            const prev = tempPlacedBoxes;
            const resolved = placeWithoutOverlap({ x: ax, y: ay, dx, dy }, prev);

            dx = resolved.dx;
            dy = resolved.dy;

            // store box for next iterations
            tempPlacedBoxes.push({ x: ax + dx, y: ay + dy, w: 150, h: 60 });
          }


          return {
            note: {
              title: d.title || `₹${d.Close}`,
              label: d.label || '',
              align: 'middle',
              wrap: isMobile ? 80 : 150
            },
            subject: {
              radius: isMobile ? 14 : 20,
              radiusPadding: 5
            },
            data: d,
            dx,
            dy,
            subject: {
              radius: 20,
              radiusPadding: 5
            },
            color: this.#colors.annotationLineColor,
            disable: ['subject']
          };
        })
      ).on("dragend", ann => {
        this.#annotationCache.set(ann.data.id, { dx: ann.dx, dy: ann.dy });
      });


    const group = d3.select(`#${this.#objectIDs.candleContainerId}`)
      .style("touch-action", "none") // critical for touch drag
      .style("z-index", 100)
      .append("g")
      .attr("class", "annotation-group")
      .call(makeAnnotation)
      .raise();

    // drawTradeGradientAreas(this, group);
    modifyAnnotationEnd(group, this.#colors, isMobile);

  }

  #handleScrollZoom(e) {

    let location = getCursorPoint(this.#objectIDs.svgId, e.sourceEvent);

    this.#zoomFactor *= e.transform.k > 1 ? 1.1 : 0.9;

    // 🔧 Clamp zoomFactor between 1 candle and full data
    const totalCandles = this.data.length;
    const minZoom = totalCandles + 100;
    const maxZoom = 1;
    this.#zoomFactor = Math.min(totalCandles / maxZoom, Math.max(this.#zoomFactor, totalCandles / minZoom));


    let width = parseDate(this.#minMaxDate[1]) - parseDate(this.#minMaxDate[0]);
    let newWidth = Math.round(width / this.#zoomFactor);

    let svgWidth = document.getElementById(
      `${this.#objectIDs.candleContainerId}`
    ).width.baseVal.value;

    let target = this.#xScaleFunc.invert(location.x).getTime();
    let coeff = Math.round((newWidth * location.x) / svgWidth);
    let left = target - coeff;
    let right = left + newWidth;

    this.#zoomRange1 = left;
    this.#zoomRange2 = right;
    // this.#zoomRange2 += (right - this.#zoomRange1) * this.#rightOffsetFactor;


    let filteredData = this.data.filter((x) => {
      return (
        parseDate(x.Date).getTime() > left - this.#candleWidthDate &&
        parseDate(x.Date).getTime() < right + this.#candleWidthDate
      );
    });

    this.#filteredData = filteredData;

    this.draw();
  }

  #handleMouseMove(e, d) {

    let location = getCursorPoint(this.#objectIDs.svgId, e);

    if (location.x > this.#config.width) location.x = this.#config.width;
    if (location.y > this.#config.height) location.y = this.#config.svgHeight;

    //x line
    if (!this.#lockSelectorX) this.#xLineHandler(d, location.x);

    //y line
    this.#yLineHandler(d, location.y);

    //x label
    if (!this.#lockSelectorX) {
      this.#xLabelHandler(d, location.x);
    }

    //y label
    this.#yLabelHandler(d, location.y);

    if (this.#mode === 'draw' && this.#drawPoint1 && !this.#drawPoint2 && this.#tempLine) {

      // Update temp line dynamically
      this.#tempLine
        .attr('x1', this.#drawPoint1.x)
        .attr('y1', this.#drawPoint1.y)
        .attr('x2', location.x)
        .attr('y2', location.y);

    }

    if (this.#isMouseDown && this.#mode === 'zoom') {
      this.#zoomPoint2 = location.x;
      this.#handleZoomBox();
    } else if (this.#isMouseDown && this.#mode === 'pan') {
      this.#handlePan(location.x);
    }

  }

  #handleMouseLeave() {
    let xLine = document.getElementById(this.#objectIDs.xLineSelectorId);
    let yLine = document.getElementById(this.#objectIDs.yLineSelectorId);
    let xLabel = document.getElementById(this.#objectIDs.xLabelSelectorId);
    let yLabel = document.getElementById(this.#objectIDs.yLabelSelectorId);

    if (xLine) xLine.remove();
    if (yLine) yLine.remove();
    if (xLabel) xLabel.remove();
    if (yLabel) yLabel.remove();
  }

  #handleMouseDown(e) {
    this.#isMouseDown = true;
    let location = getCursorPoint(this.#objectIDs.svgId, e);
    if (this.#mode === 'zoom') {
      this.#zoomPoint1 = location.x;
    } else if (this.#mode === 'pan') {
      this.#panTargetDate = this.#xScaleFunc.invert(location.x).getTime();
    }

  }

  #handleMouseUp() {
    this.#isMouseDown = false;
    if (this.#mode === 'zoom') {
      this.#handleZoom();
      this.#zoomPoint1 = 0;
      this.#zoomPoint2 = 0;
    } else if (this.#mode === 'pan') {
      this.#panTargetDate = 0;
    }
  }

  #addEventListeners() {

    let thisProxy = this;

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .candle`)
      .on('mouseover', function (e, d) {
        thisProxy.#mouseMoveLockers(d);
      })
      .on('mouseleave', (e, d) => {
        thisProxy.#mouseLeaveLocker(d);
      });

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .candle-locker`)
      .on('mouseover', function (e, d) {
        thisProxy.#mouseMoveLockers(d);
      })
      .on('mouseleave', (e, d) => {
        thisProxy.#mouseLeaveLocker(d);
      });

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .sl`)
      .on('mouseover', function (e, d) {
        thisProxy.#mouseMoveLockers(d);
      })
      .on('mouseleave', (e, d) => {
        thisProxy.#mouseLeaveLocker(d);
      });

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .tp`)
      .on('mouseover', function (e, d) {
        thisProxy.#mouseMoveLockers(d);
      })
      .on('mouseleave', (e, d) => {
        thisProxy.#mouseLeaveLocker(d);
      });

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .short`)
      .on('mouseover', function (e, d) {
        thisProxy.#mouseMoveLockers(d);
      })
      .on('mouseleave', (e, d) => {
        thisProxy.#mouseLeaveLocker(d);
      });

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .long`)
      .on('mouseover', function (e, d) {
        thisProxy.#mouseMoveLockers(d);
      })
      .on('mouseleave', (e, d) => {
        thisProxy.#mouseLeaveLocker(d);
      });

    d3.select(`#${this.#objectIDs.candleContainerId}`).on(
      'mouseleave',
      function (e, d) {
        thisProxy.#handleMouseLeave();
      }
    );

    d3.select(`#${this.#objectIDs.candleContainerId}`).on(
      'mousedown',
      function (e, d) {
        thisProxy.#handleMouseDown(e);
      }
    );

    d3.select(`#${this.#objectIDs.candleContainerId}`).on(
      'mouseup',
      function (e, d) {
        thisProxy.#handleMouseUp();
      }
    );

    d3.select(`#${this.#objectIDs.candleContainerId}`).on(
      'touchstart',
      function (e, d) {
        thisProxy.#handleMouseDown(e);
      }
    );

    d3.select(`#${this.#objectIDs.candleContainerId}`).on(
      'touchend',
      function (e, d) {
        thisProxy.#handleMouseUp();
      }
    );

    d3.select(`#${this.#objectIDs.candleContainerId}`).on('mousemove', (event, d) => {
      thisProxy.#handleMouseMove(event, d);
    });

    d3.select(`#${this.#objectIDs.candleContainerId}`).on('touchmove', (event, d) => {
      thisProxy.#handleMouseMove(event, d);
    });


    d3.select(`#${this.#objectIDs.candleContainerId}`).on('click', (e, d) => {
      const location = getCursorPoint(this.#objectIDs.svgId, e);
      if (this.#mode === 'measure') {
        this.#handleMeasure(location);
      } else if (this.#mode === 'draw') {
        this.#handleDrawLine(location);
      }
    });

    d3.select(`#${this.#objectIDs.toolsBtnsContainer} #tools-btn-reset`)
      .on('click', () => this.#handleResetZoom());

    d3.select(`#${this.#objectIDs.toolsBtnsContainer} #tools-btn-chartmode`)
      .on('click', () => {
        this.toggleChartMode();
        // Refresh the icon after toggle
        d3.select(`#${this.#objectIDs.toolsBtnsContainer} #tools-btn-chartmode`)
          .html(this.#getChartTypeIcon());
      });

    d3.select(`#${this.#objectIDs.toolsBtnsContainer}-dropdown #tools-menu-zoom`)
      .on('click', () => { this.#modeHandler('zoom'); this.#closeMenu(); });

    d3.select(`#${this.#objectIDs.toolsBtnsContainer}-dropdown #tools-menu-pan`)
      .on('click', () => { this.#modeHandler('pan'); this.#closeMenu(); });

    d3.select(`#${this.#objectIDs.toolsBtnsContainer}-dropdown #tools-menu-draw`)
      .on('click', () => { this.#modeHandler('draw'); this.#closeMenu(); });

    d3.select(`#${this.#objectIDs.toolsBtnsContainer}-dropdown #tools-menu-measure`)
      .on('click', () => { this.#modeHandler('measure'); this.#closeMenu(); });

    d3.select(`#${this.#objectIDs.toolsBtnsContainer}-dropdown #tools-menu-share`)
      .on('click', () => { this.shareChartScreenshot(); this.#closeMenu(); });


    let zoom = d3.zoom().on('zoom', function (e) {
      thisProxy.#handleScrollZoom(e);
    });

    d3.select(`#${this.#objectIDs.svgId}`)
      .call(zoom)
      .on('mousedown.zoom', null)
      .on('touchstart.zoom', null)
      .on('touchmove.zoom', null)
      .on('touchend.zoom', null);
  }

  #closeMenu() {
    d3.select(`#${this.#objectIDs.toolsBtnsContainer}-dropdown`).style('display', 'none');
  }

  #removeEventListeners() {

    if (!this.#objectIDs.candleContainerId) return;

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .candle`)
      .on('mouseover', this.#noop)
      .on('mouseleave', this.#noop);

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .candle-locker`)
      .on('mouseover', this.#noop)
      .on('mouseleave', this.#noop);

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .sl`)
      .on('mouseover', this.#noop)
      .on('mouseleave', this.#noop);

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .tp`)
      .on('mouseover', this.#noop)
      .on('mouseleave', this.#noop);

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .short`)
      .on('mouseover', this.#noop)
      .on('mouseleave', this.#noop);

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .long`)
      .on('mouseover', this.#noop)
      .on('mouseleave', this.#noop);

    d3.select(`#${this.#objectIDs.candleContainerId}`).on('mousemove', null);

    d3.select(`#${this.#objectIDs.candleContainerId}`).on('mouseleave', null);

    d3.select(`#${this.#objectIDs.candleContainerId}`).on('mousedown', null);

    d3.select(`#${this.#objectIDs.candleContainerId}`).on('mouseup', null);

    d3.select(`#${this.#objectIDs.toolsBtnsContainer} #tools-btn-0`).on(
      'click',
      null
    );

    d3.select(`#${this.#objectIDs.toolsBtnsContainer} #tools-btn-1`).on(
      'click',
      null
    );
    d3.select(`#${this.#objectIDs.toolsBtnsContainer} #tools-btn-2`).on(
      'click',
      null
    );

    d3.select(`#${this.#objectIDs.toolsBtnsContainer} #tools-btn-3`).on(
      'click',
      null
    );

    d3.select(`#${this.#objectIDs.toolsBtnsContainer} #tools-btn-4`).on(
      'click',
      null
    );


    d3.zoom().on('zoom', null);
  }

  #renderBrush() {

    if (this.#isPnLWindowClosed) return;

    const svg = d3.select(`#${this.#objectIDs.svgId}`);
    const height = this.#config.svgHeight;
    const width = this.#config.svgWidth;

    let winX = this.#brushState?.winX ?? width * 0.1;
    let winWidth = this.#brushState?.winWidth ?? width * 0.12;

    const handleW = 5;
    const handleHeight = height * 0.2;
    const handleYOffset = (height - handleHeight) / 2;
    const minWidth = handleW * 2 + 6;
    const closeSize = 14;
    const gripDotR = 1.8;
    const gripSpacing = 6;

    // top layer
    let brushLayer = svg.select(`#${this.id}-brush-layer`);
    if (brushLayer.empty()) {
      brushLayer = svg.append("g").attr("id", `${this.id}-brush-layer`);
    } else {
      brushLayer.selectAll("*").remove();
    }
    brushLayer.raise();

    // window
    const windowRect = brushLayer.append("rect")
      .attr("y", 0)
      .attr("height", height)
      .attr("rx", 2)
      .attr("fill", "rgba(20,228,107,0.01)")
      .attr("stroke", "#888")
      .attr("cursor", "grab");

    // ── Left Handle ───────────────────────────────────────
    const leftHandleGroup = brushLayer.append("g")
      .attr("class", "brush-handle-left")
      .style("cursor", "ew-resize");

    leftHandleGroup.append("rect")
      .attr("y", handleYOffset)
      .attr("width", handleW)
      .attr("height", handleHeight)
      .attr("rx", 3)
      .attr("fill", "rgba(34, 211, 238, 0.85)")
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.5);

    [-gripSpacing, 0, gripSpacing].forEach(offset => {
      leftHandleGroup.append("circle")
        .attr("r", gripDotR)
        .attr("cx", handleW / 2)
        .attr("cy", handleYOffset + handleHeight / 2 + offset)
        .attr("fill", "rgba(0,0,0,0.5)");
    });

    leftHandleGroup
      .on("mouseenter", function () {
        d3.select(this).select("rect")
          .attr("fill", "rgba(34, 211, 238, 1)")
          .attr("stroke-width", 1.5);
      })
      .on("mouseleave", function () {
        d3.select(this).select("rect")
          .attr("fill", "rgba(34, 211, 238, 0.85)")
          .attr("stroke-width", 0.5);
      });

    // ── Right Handle ──────────────────────────────────────
    const rightHandleGroup = brushLayer.append("g")
      .attr("class", "brush-handle-right")
      .style("cursor", "ew-resize");

    rightHandleGroup.append("rect")
      .attr("y", handleYOffset)
      .attr("width", handleW)
      .attr("height", handleHeight)
      .attr("rx", 3)
      .attr("fill", "rgba(34, 211, 238, 0.85)")
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.5);

    [-gripSpacing, 0, gripSpacing].forEach(offset => {
      rightHandleGroup.append("circle")
        .attr("r", gripDotR)
        .attr("cx", handleW / 2)
        .attr("cy", handleYOffset + handleHeight / 2 + offset)
        .attr("fill", "rgba(0,0,0,0.5)");
    });

    rightHandleGroup
      .on("mouseenter", function () {
        d3.select(this).select("rect")
          .attr("fill", "rgba(34, 211, 238, 1)")
          .attr("stroke-width", 1.5);
      })
      .on("mouseleave", function () {
        d3.select(this).select("rect")
          .attr("fill", "rgba(34, 211, 238, 0.85)")
          .attr("stroke-width", 0.5);
      });

    // ── Close Button ──────────────────────────────────────
    const closeBtn = brushLayer.append("g")
      .attr("cursor", "pointer")
      .on("pointerdown", e => e.stopPropagation())
      .on("click", () => {
        this.#isPnLWindowClosed = true;
        this.#brushState = null;
        brushLayer.remove();
        this.draw();
      });

    closeBtn.append("circle")
      .attr("r", closeSize / 2)
      .attr("fill", "rgba(40,40,40,0.85)");

    closeBtn.append("path")
      .attr("d", "M -4 -4 L 4 4 M -4 4 L 4 -4")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.6)
      .attr("stroke-linecap", "round");

    // block pan
    brushLayer.selectAll("*")
      .on("pointerdown", e => e.stopPropagation());

    // ── Update ────────────────────────────────────────────
    const update = () => {
      winX = Math.round(winX);
      winWidth = Math.round(winWidth);

      this.#brushState = { winX, winWidth };

      windowRect
        .attr("x", winX)
        .attr("width", winWidth);

      leftHandleGroup.attr("transform", `translate(${winX - handleW / 2}, 0)`);
      rightHandleGroup.attr("transform", `translate(${winX + winWidth - handleW / 2}, 0)`);

      closeBtn.attr(
        "transform",
        `translate(${winX + winWidth - closeSize / 2 - 4},${closeSize / 2 + 4})`
      );

      drawBrushGradient(winX, winWidth, brushLayer, this.getChartData(), this.getAnnotationsData(), this.#objectIDs.svgId, this.getXScaleFunc(), this.getYScaleFunc());
    };

    update();

    // ── Drag: Window ──────────────────────────────────────
    windowRect.call(
      d3.drag()
        .on("start", e => e.sourceEvent.stopPropagation())
        .on("drag", e => {
          winX = Math.max(0, Math.min(width - winWidth, e.x));
          update();
        })
    );

    // ── Drag: Left Handle ─────────────────────────────────
    leftHandleGroup.call(
      d3.drag()
        .on("start", e => e.sourceEvent.stopPropagation())
        .on("drag", e => {
          const newX = Math.max(0, Math.min(winX + winWidth - minWidth, e.x));
          winWidth += winX - newX;
          winX = newX;
          update();
        })
    );

    // ── Drag: Right Handle ────────────────────────────────
    rightHandleGroup.call(
      d3.drag()
        .on("start", e => e.sourceEvent.stopPropagation())
        .on("drag", e => {
          winWidth = Math.max(minWidth, Math.min(width - winX, e.x - winX));
          update();
        })
    );
  }


  #renderPnLToggleButton() {

    if (!this.#isPnLWindowClosed) return;

    const svg = d3.select(`#${this.#objectIDs.svgId}`);
    const height = this.#config.svgHeight;
    const width = this.#config.svgWidth;

    // prevent duplicate
    if (!svg.select(`#${this.id}-pnl-btn`).empty()) return;

    const btnGroup = svg.append("g")
      .attr("id", `${this.id}-pnl-btn`)
      .attr("transform", `translate(${width - 40}, ${height / 2 - 70})`) // more space from edge
      .attr("cursor", "pointer")
      .on("pointerdown", e => e.stopPropagation())
      .on("click", () => {
        this.#isPnLWindowClosed = !this.#isPnLWindowClosed;
        this.draw();
      });

    // Button background
    btnGroup.append("rect")
      .attr("width", 20)
      .attr("height", 160)
      .attr("rx", 4)
      .attr("fill", "#1f2933")
      .attr("stroke", "#3b82f6")
      .attr("stroke-width", 1.5)
      .style("filter", "drop-shadow(0 4px 8px rgba(0,0,0,0.4))");

    // Rotated text
    btnGroup.append("text")
      .attr("x", 15)
      .attr("y", 77)
      .attr("fill", "#fff")
      .attr("font-size", 14)
      .attr("font-weight", 300)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("transform", "rotate(-90, 15, 80)")
      .text("💰 View P&L Now");

  }


  setColors(colorObj) {
    for (const key in colorObj) {
      let color = colorObj[key];
      this.#colors[key] = color;
    }
  }

  setConfig(configObj) {
    for (const key in configObj) {
      let config = configObj[key];
      this.#config[key] = config;
    }

    this.#calculateExtendConfigs();
  }

  getColors() {
    return this.#colors;
  }

  getConfig() {
    return {
      candleTailWidth: this.#config.candleTailWidth,
      width: this.#config.width,
      height: this.#config.height,
      xLabelFontSize: this.#config.xLabelFontSize,
      yLabelFontSize: this.#config.yLabelFontSize,
      decimal: this.#config.decimal,
      timeFormat: this.#config.timeFormat,
    };
  }

  destroy() {
    this.#removeEventListeners();
    if (document.getElementById(this.#objectIDs.svgId))
      document.getElementById(this.#objectIDs.svgId).remove();
  }

  draw() {

    this.#calculateExtendConfigs();
    this.destroy();
    this.#createLayout();
    this.#calculateXscale();
    this.#calculateYscale();
    this.#calculateCandleWidth();
    this.#createYaxis();
    this.#createXaxis();
    this.#createInfoText();
    this.#createLockerGroup();
    this.#createLockerBody();
    this.#createCandlesGroup();
    this.#createCandlesBody();
    this.#createCandlesHigh();
    this.#createCandlesLow();
    if (this.#candlePatternActive) this.#highlightPatternCandles();
    this.#addEventListeners();
    this.#drawStaticAnnotationFromData();
    this.#redrawCachedLines();
    this.#drawEMALines();
    if (this.#showVolume) this.#drawVolumeChart();
    if (this.#showRSI) this.#drawRSIPanel();
    this.#renderBrush();
    this.#renderPnLToggleButton();
    this.#initPatternTooltip();

  }

}

export default CandleStickChart;