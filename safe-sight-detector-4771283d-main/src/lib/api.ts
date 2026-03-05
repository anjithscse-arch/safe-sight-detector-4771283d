export const API_BASE = (
  import.meta.env.VITE_API_BASE_URL?.trim() || "http://127.0.0.1:5000"
).replace(/\/+$/, "");

export interface PredictApiResponse {
  request_id: string;
  result: "Real" | "Fake";
  confidence: number;
}

export async function uploadImage(file: File): Promise<PredictApiResponse> {
  const formData = new FormData();
  formData.append("file", file);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/predict`, {
      method: "POST",
      body: formData,
    });
  } catch {
    throw new Error(`Cannot connect to backend at ${API_BASE}`);
  }

  if (!response.ok) {
    let message = `Prediction failed (${response.status})`;
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload?.error) {
        message = payload.error;
      }
    } catch {
      // Keep generic message when response body is not JSON.
    }
    throw new Error(message);
  }

  return response.json() as Promise<PredictApiResponse>;
}
