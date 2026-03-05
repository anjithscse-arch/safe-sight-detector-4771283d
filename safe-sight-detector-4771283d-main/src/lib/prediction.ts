import { API_BASE, uploadImage, type PredictApiResponse } from "./api";

export interface PredictionResult {
  label: "Real" | "Fake";
  confidence: number;
  confidenceText: string;
  requestId: string;
}

export async function runPrediction(file: File): Promise<PredictionResult> {
  let data: PredictApiResponse;
  try {
    data = await uploadImage(file);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Cannot connect to backend at ${API_BASE}`);
  }

  const percent = data.confidence;

  let confidenceText: string;
  if (percent > 85) confidenceText = "Very high confidence - strong indicators detected.";
  else if (percent > 65) confidenceText = "Moderate confidence - anomalies detected.";
  else if (percent > 40) confidenceText = "Low confidence - minor irregularities.";
  else confidenceText = "Very low confidence of manipulation.";

  return {
    label: data.result,
    confidence: percent,
    confidenceText,
    requestId: data.request_id,
  };
}
