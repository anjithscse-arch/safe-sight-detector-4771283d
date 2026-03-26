import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { logout } from "@/lib/auth";
import { detectDeepfake, type PredictionResult } from "@/lib/prediction";
import { generateReport } from "@/lib/report";
import { Shield, Upload, LogOut, FileText, AlertTriangle, CheckCircle, XCircle, Image as ImageIcon } from "lucide-react";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/jpg", "image/webp"];

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!user) { navigate("/login"); return null; }

  const handleFile = (f: File) => {
    if (!ACCEPTED_TYPES.includes(f.type)) { alert("Please upload a JPG, PNG, or WEBP image only."); return; }
    setFile(f);
    setResult(null);
    setAnalysisError(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const getConfidenceExplanation = (probability: number, isFake: boolean): string => {
    if (isFake) {
      if (probability >= 85) return "Very high confidence - strong manipulation indicators detected.";
      if (probability >= 65) return "Moderate confidence - multiple deepfake artifacts detected.";
      return "Low confidence - some manipulation signals were detected.";
    }
    if (probability >= 85) return "Very high confidence - image appears authentic.";
    if (probability >= 65) return "Moderate confidence - image appears mostly authentic.";
    return "Low confidence - authenticity is likely but not definitive.";
  };

  const analyze = async () => {
    if (!file) return;

    setAnalyzing(true);
    setAnalysisError(null);

    try {
      const detection = await detectDeepfake(file);
      const probability = Number(detection.confidence || 0);
      const label: PredictionResult["label"] = detection.is_fake ? "Fake" : "Real";

      setResult({
        label,
        probability,
        confidence: getConfidenceExplanation(probability, detection.is_fake),
      });
    } catch (error) {
      setResult(null);
      setAnalysisError(error instanceof Error ? error.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const clearImage = () => { setFile(null); setPreview(null); setResult(null); setAnalysisError(null); };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground">DeepfakeGuard</h1>
              <p className="text-xs text-muted-foreground">Detection System</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">Hi, <span className="font-medium text-foreground">{user.username}</span></span>
            <button onClick={handleLogout} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8">
          <h2 className="text-xl font-bold text-foreground">Dashboard</h2>
          <p className="mt-1 text-sm text-muted-foreground">Upload an image to check if it has been digitally manipulated.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Upload Section */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
              <ImageIcon className="h-4 w-4 text-primary" /> Image Upload
            </h3>
            {!preview ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}
              >
                <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="mb-1 text-sm font-medium text-foreground">Drag & drop your image here</p>
                <p className="mb-4 text-xs text-muted-foreground">Supports JPG, PNG and WEBP files</p>
                <label className="cursor-pointer rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90">
                  Browse Files
                  <input type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                </label>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative overflow-hidden rounded-xl border border-border">
                  <img src={preview} alt="Preview" className="w-full object-contain" style={{ maxHeight: 300 }} />
                  {analyzing && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                      <div className="text-center">
                        <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        <p className="text-sm font-medium text-primary">Analyzing...</p>
                      </div>
                    </div>
                  )}
                </div>
                {analysisError ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {analysisError}
                  </div>
                ) : null}
                <div className="flex items-center justify-between">
                  <p className="truncate text-xs text-muted-foreground">{file?.name}</p>
                  <div className="flex gap-2">
                    <button onClick={clearImage} className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary">Clear</button>
                    <button onClick={analyze} disabled={analyzing}
                      className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                      {analyzing ? "Analyzing..." : "Analyze Image"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Results Section */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
              <FileText className="h-4 w-4 text-primary" /> Analysis Results
            </h3>
            {!result ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
                <Shield className="mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Upload and analyze an image to see results here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className={`flex items-center gap-3 rounded-xl p-4 ${result.label === "Fake" ? "border border-destructive/30 bg-destructive/10 glow-destructive" : "border border-success/30 bg-success/10"}`}>
                  {result.label === "Fake" ? <XCircle className="h-6 w-6 text-destructive" /> : <CheckCircle className="h-6 w-6 text-success" />}
                  <div>
                    <p className={`text-lg font-bold ${result.label === "Fake" ? "text-destructive" : "text-success"}`}>{result.label}</p>
                    <p className="text-xs text-muted-foreground">{result.probability}% {result.label === "Fake" ? "manipulated" : "authentic"}</p>
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>Probability Score</span><span>{result.probability}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                    <div className={`h-full rounded-full transition-all duration-700 ${result.label === "Fake" ? "bg-destructive" : "bg-success"}`}
                      style={{ width: `${result.probability}%` }} />
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-secondary/50 p-3">
                  <p className="mb-1 text-xs font-medium text-foreground">Confidence Explanation</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{result.confidence}</p>
                </div>
                {result.label === "Fake" && (
                  <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-warning" />
                      <p className="text-sm font-semibold text-warning">Safety Advisory</p>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      This image has been flagged as potentially manipulated. If used maliciously, consider contacting cybercrime authorities. Preserve the original file and avoid sharing manipulated content.
                    </p>
                  </div>
                )}
                <button
                  onClick={() => generateReport(user.username, file?.name || "unknown", result)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20">
                  <FileText className="h-4 w-4" /> Generate PDF Report
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
