export interface PredictionResult {
  label: "Real" | "Fake";
  probability: number;
  confidence: string;
}

export interface DeepfakeDetectionResponse {
  is_fake: boolean;
  confidence: number;
  label: "FAKE" | "REAL";
  scores: Record<string, number>;
}

export function runDummyPrediction(): PredictionResult {
  const probability = Math.random();
  const isFake = probability > 0.45;
  const percent = isFake ? 55 + Math.floor(Math.random() * 40) : 10 + Math.floor(Math.random() * 35);

  let confidence: string;
  if (percent > 85) confidence = "Very high confidence - strong indicators of manipulation detected in facial regions and texture patterns.";
  else if (percent > 65) confidence = "Moderate confidence - some anomalies found in lighting and edge consistency that suggest possible manipulation.";
  else if (percent > 40) confidence = "Low confidence - minor irregularities detected, but the image appears mostly authentic.";
  else confidence = "Very low probability of manipulation - the image shows consistent patterns typical of genuine photographs.";

  return {
    label: isFake ? "Fake" : "Real",
    probability: percent,
    confidence,
  };
}

export async function detectDeepfake(file: File): Promise<DeepfakeDetectionResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/detect", {
    method: "POST",
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.detail || data?.error || "Detection failed");
  }

  return data as DeepfakeDetectionResponse;
}
