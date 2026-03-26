import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function DeepfakeDetector() {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImage(file);
    setPreview(URL.createObjectURL(file));
    setResult(null);
    setError(null);
  };

  const handleDetect = async () => {
    if (!image) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", image);

    try {
      const response = await fetch("http://localhost:5000/api/detect", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.detail || data?.error || "Detection failed");
      }

      setResult(data);
    } catch (err) {
      setResult(null);
      setError(err?.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const realScore = Number(result?.scores?.Real || 0);
  const fakeScore = Number(result?.scores?.Fake || 0);
  const confidence = Number(result?.confidence || 0);
  const progressWidth = `${Math.min(Math.max(confidence, 0), 100)}%`;

  return (
    <div className="mx-auto mt-10 w-full max-w-2xl space-y-4">
      <div
        className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-card/60 p-6 text-center transition-colors hover:border-primary/60"
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        {preview ? (
          <img src={preview} alt="preview" className="max-h-80 w-full rounded-xl object-contain" />
        ) : (
          <>
            <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Click to upload an image</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleImageChange}
          className="hidden"
        />
      </div>

      {image && !loading ? (
        <Button className="w-full" onClick={handleDetect}>
          Analyze Image
        </Button>
      ) : null}

      {loading ? <p className="text-center text-sm text-muted-foreground">Analyzing image...</p> : null}
      {error ? <p className="text-center text-sm text-red-500">{error}</p> : null}

      {result ? (
        <Card className={`p-5 ${result.is_fake ? "border-red-400/70 bg-red-50/50" : "border-green-400/70 bg-green-50/50"}`}>
          <h3 className={`text-lg font-semibold ${result.is_fake ? "text-red-600" : "text-green-600"}`}>
            {result.is_fake ? "\u26A0\uFE0F DEEPFAKE DETECTED" : "\u2705 LIKELY REAL"}
          </h3>

          <p className="mt-2 text-sm text-foreground">Confidence: {confidence.toFixed(2)}%</p>
          <div className="mt-2">
            {result.source === "local_model" || result.source === "efficientnet_b0" ? (
              <span className="inline-flex rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                {"\u{1F5A5}\uFE0F"} EfficientNet-B0
              </span>
            ) : null}
            {result.source === "huggingface_local" ? (
              <span className="inline-flex rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                {"\u{1F917}"} HuggingFace Local
              </span>
            ) : null}
          </div>

          <div className="mt-2 h-2 w-full rounded-full bg-muted">
            <div
              className={`h-2 rounded-full ${result.is_fake ? "bg-red-500" : "bg-green-500"}`}
              style={{ width: progressWidth }}
            />
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>Real: {realScore.toFixed(2)}%</span>
            <span>Fake: {fakeScore.toFixed(2)}%</span>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            This is an AI-assisted indicator, not a definitive verdict.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
