// Bundles Chart.js and jsPDF into a single IIFE for the VS Code webview.
// Exposes globals expected by the webview: window.Chart and window.jspdf/window.jsPDF.

// Chart.js: use the "auto" entry which registers all controllers/elements
import Chart from 'chart.js/auto';

// jsPDF: use the ESM entry and then expose the UMD-style globals
import { jsPDF } from 'jspdf';

// Expose globals for the webview script usage
// eslint-disable-next-line no-undef
const g = (typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : self));
g.Chart = Chart;
g.jspdf = { jsPDF };
g.jsPDF = jsPDF;
