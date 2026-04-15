from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from datetime import datetime

def create_pdf(stress, confidence, truth, emotion_distribution=None, name="Candidate", code="N/A"):

    doc = SimpleDocTemplate("report.pdf", pagesize=letter)

    styles = getSampleStyleSheet()
    content = []

    # 🧠 TITLE
    content.append(Paragraph("TruthLens AI Interview Report", styles['Title']))
    content.append(Spacer(1, 20))

    # 👤 Candidate Info
    content.append(Paragraph(f"<b>Name:</b> {name}", styles['Normal']))
    content.append(Paragraph(f"<b>Interview Code:</b> {code}", styles['Normal']))
    content.append(Paragraph(f"<b>Date:</b> {datetime.now().strftime('%Y-%m-%d %H:%M')}", styles['Normal']))
    content.append(Spacer(1, 20))

    # 📊 Summary Scores
    content.append(Paragraph("<b>Analysis Summary</b>", styles['Heading2']))
    content.append(Spacer(1, 10))

    content.append(Paragraph(f"Stress Level: {int(stress * 100)}%", styles['Normal']))
    content.append(Paragraph(f"Confidence Level: {int(confidence * 100)}%", styles['Normal']))
    content.append(Paragraph(f"Truth Score: {int(truth * 100)}%", styles['Normal']))
    content.append(Spacer(1, 20))

    # 🎭 Emotional Breakdown
    if emotion_distribution:
        content.append(Paragraph("<b>Emotional Breakdown</b>", styles['Heading2']))
        content.append(Spacer(1, 10))
        
        data = [["Emotion", "Intensity"]]
        for emotion, prob in emotion_distribution.items():
            data.append([emotion.capitalize(), f"{int(prob * 100)}%"])
        
        table = Table(data, colWidths=[100, 100])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.cadetblue),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        content.append(table)
        content.append(Spacer(1, 20))

    # 🧠 Interpretation
    if truth > 0.6:
        result = "Candidate appears confident and truthful based on behavioral cues."
    elif truth > 0.3:
        result = "Candidate shows moderate confidence; some signs of stress detected."
    else:
        result = "Candidate exhibits significant indicators of stress or uncertainty."

    content.append(Paragraph("<b>Final Assessment</b>", styles['Heading2']))
    content.append(Spacer(1, 10))
    content.append(Paragraph(result, styles['Normal']))

    # Build PDF
    doc.build(content)

    print("📄 Professional Report Generated!")