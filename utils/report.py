from reportlab.platypus import SimpleDocTemplate, Paragraph
from reportlab.lib.styles import getSampleStyleSheet

def generate_report(name, code, emotions, final_emotion, truth_score, deepface):

    doc = SimpleDocTemplate("report.pdf")
    styles = getSampleStyleSheet()

    content = []

    content.append(Paragraph("TruthLens Interview Report", styles['Title']))
    content.append(Paragraph(f"Name: {name}", styles['Normal']))
    content.append(Paragraph(f"Session Code: {code}", styles['Normal']))
    content.append(Paragraph(f"Final Emotion: {final_emotion}", styles['Normal']))
    content.append(Paragraph(f"Truth Score: {truth_score:.2f}%", styles['Normal']))

    content.append(Paragraph("Timeline:", styles['Heading2']))

    for e in emotions:
        content.append(Paragraph(e, styles['Normal']))

    doc.build(content) 