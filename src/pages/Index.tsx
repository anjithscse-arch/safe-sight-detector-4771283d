import { Link } from "react-router-dom";
import { Shield, Upload, FileText, AlertTriangle } from "lucide-react";
import DeepfakeDetector from "@/components/DeepfakeDetector";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="flex flex-col items-center justify-center px-4 pt-24 pb-16 text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 glow-primary">
          <Shield className="h-8 w-8 text-primary" />
        </div>
        <h1 className="mb-3 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          DeepfakeGuard
        </h1>
        <p className="mb-2 text-lg text-muted-foreground">
          User-Centric Deepfake Image Detection System
        </p>
        <p className="mb-8 max-w-md text-sm text-muted-foreground">
          Upload any image and get instant analysis on whether it's been digitally manipulated. Simple, fast, and designed with your safety in mind.
        </p>
        <div className="flex gap-3">
          <Link to="/register" className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
            Get Started
          </Link>
          <Link to="/login" className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary">
            Sign In
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className="mx-auto max-w-4xl px-4 pb-20">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: Upload, title: "Easy Upload", desc: "Drag and drop or select any JPG/PNG image for instant analysis." },
            { icon: AlertTriangle, title: "Safety Alerts", desc: "Get clear warnings and safety guidance when manipulation is detected." },
            { icon: FileText, title: "PDF Reports", desc: "Download detailed reports with analysis results and legal guidance." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/30">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-4.5 w-4.5 text-primary" />
              </div>
              <h3 className="mb-1 text-sm font-semibold text-foreground">{title}</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 pb-20">
        <DeepfakeDetector />
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        B.Tech Mini Project — Deepfake Image Detection System with Safety Support
      </footer>
    </div>
  );
};

export default Index;
