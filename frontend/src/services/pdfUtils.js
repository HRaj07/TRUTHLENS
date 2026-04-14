import { jsPDF } from 'jspdf';
// jspdf-autotable v5 attaches to jsPDF.prototype as a side-effect import
import autoTable from 'jspdf-autotable';

// ─────────────────────────────────────────────────────────────
//  downloadSessionPDF
//  Generates and triggers download of the TruthLens session PDF.
//  Compatible with jsPDF v4 + jspdf-autotable v5.
// ─────────────────────────────────────────────────────────────
export const downloadSessionPDF = (reportData = {}) => {
  const {
    sessionCode   = 'N/A',
    candidateName = 'Unknown Candidate',
    interviewerName = 'Unknown Interviewer',
    duration      = 0,
    aggregateStats = {},
    emotionHistory = [],
    endTime       = new Date().toISOString(),
  } = reportData;

  const {
    avgTruth        = 0,
    avgConfidence   = 0,
    avgStress       = 0,
    dominantEmotion = 'neutral',
    consistencyScore = 0,
    totalFrames     = 0,
    emotionCounts   = {},
  } = aggregateStats;

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  // ── Colour palette ───────────────────────────────────────────
  const NEON   = [56,  189, 248];   // #38bdf8
  const DARK   = [15,  23,  42];    // #0f172a
  const MID    = [30,  41,  59];    // #1e293b
  const LIGHT  = [148, 163, 184];   // #94a3b8
  const WHITE  = [255, 255, 255];
  const GREEN  = [16,  185, 129];   // #10b981
  const RED    = [239, 68,  68];    // #ef4444

  // ── Header banner ────────────────────────────────────────────
  doc.setFillColor(...DARK);
  doc.rect(0, 0, W, 45, 'F');

  // Accent stripe
  doc.setFillColor(...NEON);
  doc.rect(0, 42, W, 3, 'F');

  doc.setTextColor(...WHITE);
  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  doc.text('TRUTHLENS', 14, 22);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...LIGHT);
  doc.text('BEHAVIORAL INTELLIGENCE REPORT  |  AI-POWERED INTERVIEW ANALYTICS', 14, 30);

  // Session badge (top-right)
  doc.setFillColor(...MID);
  doc.roundedRect(W - 60, 8, 50, 28, 3, 3, 'F');
  doc.setTextColor(...NEON);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('SESSION CODE', W - 35, 16, { align: 'center' });
  doc.setFontSize(14);
  doc.text(sessionCode, W - 35, 28, { align: 'center' });

  // ── Session meta ─────────────────────────────────────────────
  let y = 55;
  doc.setTextColor(50, 62, 80);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');

  const metaLeft = [
    ['Candidate',    candidateName],
    ['Interviewer',  interviewerName],
    ['Date',         new Date(endTime).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
    ['Duration',     `${Math.floor(duration / 60)}m ${duration % 60}s`],
    ['Frames Analyzed', String(totalFrames)],
  ];

  metaLeft.forEach(([label, val]) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...LIGHT);
    doc.text(label + ':', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 50, 65);
    doc.text(val, 55, y);
    y += 7;
  });

  // ── Score bars ───────────────────────────────────────────────
  y += 4;
  doc.setFillColor(...DARK);
  doc.rect(0, y - 4, W, 58, 'F');

  const scores = [
    { label: 'TRUTH SCORE',      value: avgTruth,        color: GREEN },
    { label: 'CONFIDENCE LEVEL', value: avgConfidence,   color: NEON  },
    { label: 'STRESS LEVEL',     value: avgStress,       color: RED   },
    { label: 'CONSISTENCY',      value: consistencyScore, color: NEON  },
  ];

  const colW = (W - 28) / 4;
  scores.forEach(({ label, value, color }, i) => {
    const x = 14 + i * colW;
    const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);

    doc.setTextColor(...LIGHT);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(label, x + colW / 2, y + 6, { align: 'center' });

    doc.setTextColor(...WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text(`${pct}%`, x + colW / 2, y + 20, { align: 'center' });

    // Bar background
    doc.setFillColor(...MID);
    doc.roundedRect(x, y + 24, colW - 4, 5, 1, 1, 'F');

    // Bar fill
    doc.setFillColor(...color);
    const fillW = (colW - 4) * (pct / 100);
    if (fillW > 0) doc.roundedRect(x, y + 24, fillW, 5, 1, 1, 'F');
  });

  y += 40;

  // Dominant emotion chip
  doc.setFillColor(...MID);
  doc.roundedRect(14, y, 60, 10, 2, 2, 'F');
  doc.setTextColor(...NEON);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('DOMINANT EMOTION:', 17, y + 6.5);
  doc.setTextColor(...WHITE);
  doc.text(dominantEmotion.toUpperCase(), 68, y + 6.5, { align: 'right' });

  y += 16;

  // ── Executive summary table ───────────────────────────────────
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Executive Summary', 14, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Score', 'Assessment']],
    body: [
      ['Truth Score',       `${Math.round(avgTruth * 100)}%`,        avgTruth >= 0.7 ? '✓ High Integrity' : avgTruth >= 0.4 ? '~ Moderate' : '✗ Low'],
      ['Confidence Level',  `${Math.round(avgConfidence * 100)}%`,   avgConfidence >= 0.7 ? '✓ Confident' : avgConfidence >= 0.4 ? '~ Moderately Confident' : '✗ Uncertain'],
      ['Stress Level',      `${Math.round(avgStress * 100)}%`,       avgStress <= 0.3 ? '✓ Composed' : avgStress <= 0.6 ? '~ Some Tension' : '✗ High Stress'],
      ['Consistency',       `${Math.round(consistencyScore * 100)}%`, consistencyScore >= 0.7 ? '✓ Consistent' : '~ Variable'],
      ['Dominant Emotion',  dominantEmotion.toUpperCase(),            '—'],
    ],
    theme: 'grid',
    headStyles: { fillColor: NEON, textColor: WHITE, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: [40, 50, 65] },
    alternateRowStyles: { fillColor: [245, 248, 252] },
    columnStyles: { 2: { textColor: GREEN, fontStyle: 'bold' } },
  });

  // ── Emotion distribution table ────────────────────────────────
  let nextY = doc.lastAutoTable?.finalY ?? 160;
  nextY += 10;

  if (Object.keys(emotionCounts).length > 0) {
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Emotion Distribution', 14, nextY);
    nextY += 4;

    const emotionRows = Object.entries(emotionCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([emotion, count]) => [
        emotion.charAt(0).toUpperCase() + emotion.slice(1),
        String(count),
        `${totalFrames > 0 ? Math.round((count / totalFrames) * 100) : 0}%`,
      ]);

    autoTable(doc, {
      startY: nextY,
      head: [['Emotion', 'Frame Count', 'Percentage']],
      body: emotionRows,
      theme: 'striped',
      headStyles: { fillColor: MID, textColor: WHITE, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: [40, 50, 65] },
    });

    nextY = doc.lastAutoTable?.finalY ?? nextY + 40;
    nextY += 10;
  }

  // ── Behavioral timeline ───────────────────────────────────────
  if (emotionHistory.length > 0) {
    // Check if we need a new page
    if (nextY > 230) {
      doc.addPage();
      nextY = 20;
    }

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(`Behavioral Timeline (${emotionHistory.length} data points)`, 14, nextY);
    nextY += 4;

    const timelineRows = emotionHistory.map(entry => [
      entry.label || '',
      (entry.emotion || '').toUpperCase(),
      `${entry.truth ?? 0}%`,
      `${entry.confidence ?? 0}%`,
      `${entry.stress ?? 0}%`,
    ]);

    autoTable(doc, {
      startY: nextY,
      head: [['Time', 'Emotion', 'Truth', 'Confidence', 'Stress']],
      body: timelineRows,
      theme: 'grid',
      headStyles: { fillColor: NEON, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: [40, 50, 65] },
      alternateRowStyles: { fillColor: [245, 248, 252] },
    });
  }

  // ── Footer on every page ──────────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(...DARK);
    doc.rect(0, 285, W, 12, 'F');
    doc.setFontSize(7);
    doc.setTextColor(...LIGHT);
    doc.text(
      `Page ${i} of ${pageCount}  |  Generated by TruthLens AI v2.0  |  ${new Date().toLocaleString()}`,
      W / 2, 292, { align: 'center' }
    );
  }

  doc.save(`TruthLens_Report_${sessionCode}_${new Date().toISOString().slice(0, 10)}.pdf`);
};
