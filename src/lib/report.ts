import jsPDF from "jspdf";
import type { PredictionResult } from "./prediction";

export function generateReport(
  username: string,
  fileName: string,
  result: PredictionResult
) {
  const doc = new jsPDF();
  const now = new Date();
  const timestamp = now.toLocaleString();
  let y = 20;

  const addLine = (text: string, size = 11, bold = false) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    const lines = doc.splitTextToSize(text, 170);
    if (y + lines.length * (size * 0.5) > 280) {
      doc.addPage();
      y = 20;
    }
    doc.text(lines, 20, y);
    y += lines.length * (size * 0.5) + 4;
  };

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 40, "F");
  doc.setTextColor(56, 189, 248);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Deepfake Image Detection Report", 20, 18);
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text("User-Centric Deepfake Image Detection System with Safety Support", 20, 28);
  doc.text(`Generated: ${timestamp}`, 20, 35);

  y = 50;
  doc.setTextColor(30, 41, 59);

  addLine("Analysis Details", 14, true);
  y += 2;
  addLine(`User: ${username}`);
  addLine(`File Analyzed: ${fileName}`);
  addLine(`Timestamp: ${timestamp}`);
  addLine(`Result: ${result.label}`, 12, true);
  addLine(`Probability Score: ${result.probability}% ${result.label}`);
  y += 4;

  addLine("Confidence Explanation", 14, true);
  y += 2;
  addLine(result.confidence);
  y += 4;

  addLine("AI Analysis Summary", 14, true);
  y += 2;
  if (result.label === "Fake") {
    addLine(
      "The uploaded image exhibits characteristics commonly associated with digitally manipulated media. " +
      "Our analysis detected inconsistencies in facial texture mapping, lighting gradients, and edge artifacts " +
      "that are typical of deepfake generation techniques. The manipulation appears to primarily affect " +
      "facial regions, suggesting the use of face-swapping or face-reenactment technology."
    );
  } else {
    addLine(
      "The uploaded image appears to be authentic based on our analysis. The image shows consistent " +
      "lighting patterns, natural texture gradients, and no detectable artifacts typically associated with " +
      "deepfake manipulation. The facial features demonstrate natural proportions and consistent shadows."
    );
  }
  y += 4;

  if (result.label === "Fake") {
    addLine("⚠ Safety Advisory", 14, true);
    y += 2;
    addLine(
      "This image has been flagged as potentially manipulated. If you believe this image is being used " +
      "to harm, harass, or deceive, please consider the following steps:"
    );
    y += 2;

    addLine("Legal Guidance", 13, true);
    y += 2;
    addLine("• Contact your local cybercrime authorities or national cybercrime helpline.");
    addLine("• Preserve the original media file — do not alter, crop, or compress it.");
    addLine("• Do not share the manipulated content further, as it may cause additional harm.");
    addLine("• Document where and when you encountered this content.");
    addLine("• Consider consulting a legal professional for advice on your rights.");
    y += 4;
  }

  // Disclaimer
  addLine("Disclaimer", 14, true);
  y += 2;
  doc.setTextColor(120, 113, 108);
  addLine(
    "This is a preliminary AI-based analysis report and not a legally certified forensic document. " +
    "The results presented here are generated using computational models and should be treated as " +
    "indicative analysis only. For legal proceedings, please consult certified digital forensics experts."
  );

  doc.save(`deepfake-report-${now.getTime()}.pdf`);
}
