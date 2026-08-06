import { useNavigate } from "@/router";
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Scale,
  ShieldAlert,
  Lock,
  Database,
  FileText,
  Clock,
} from "lucide-react";

export default function LegalPage() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("disclaimer");

  const SECTIONS = [
    { id: "disclaimer", label: "App Disclaimer", icon: ShieldAlert },
    { id: "warranty", label: "Terms of Use", icon: Scale },
    { id: "privacy", label: "Privacy Policy", icon: Lock },
    { id: "attribution", label: "Data Source", icon: Database },
    { id: "license", label: "MIT License", icon: FileText },
  ];

  // Intersection Observer for scroll spy to make the TOC feel premium
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-20% 0px -60% 0px" }
    );

    SECTIONS.forEach((sec) => {
      const el = document.getElementById(sec.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setActiveSection(id);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-background text-foreground overflow-y-auto no-scrollbar pt-6 sm:pt-8 pb-16 px-4 sm:px-6 md:px-10">
      <div className="w-full max-w-6xl mx-auto space-y-10">
        
        {/* ── Header Area ─────────────────────────────────────────────────── */}
        <header className="pb-6 border-b border-border/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <button
              onClick={() => navigate(-1)}
              className="p-3 rounded-lg bg-muted/20 border border-border/15 hover:bg-muted text-muted-foreground hover:text-foreground hover:border-border/30 transition-all duration-150 cursor-pointer shrink-0"
              aria-label="Go Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  Legal Documents
                </span>
                <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground/60">
                  <Clock className="w-3 h-3" />
                  Last Updated: June 2026
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground mt-1.5 flex items-center gap-2">
                <Scale className="w-7 h-7 text-primary shrink-0" />
                Legal & Privacy Policy
              </h1>
            </div>
          </div>
        </header>

        {/* ── Mobile Navigation Chips ─────────────────────────────────────── */}
        <div className="flex lg:hidden gap-2 overflow-x-auto no-scrollbar pb-3 border-b border-border/10 -mx-4 px-4 scroll-smooth">
          {SECTIONS.map((sec) => {
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => scrollToSection(sec.id)}
                className={`px-4 py-1.5 border text-xs font-semibold rounded-md transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/10 border-border/20 text-muted-foreground hover:bg-muted/20 hover:text-foreground"
                }`}
              >
                {sec.label}
              </button>
            );
          })}
        </div>

        {/* ── Main Layout Grid ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          
          {/* Table of Contents Sidebar */}
          <aside className="hidden lg:block lg:col-span-3 sticky top-6 space-y-4">
            <div className="p-5 bg-card/25 border border-border/15 rounded-xl space-y-4">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/50 px-1">
                Document Sections
              </p>
              <nav className="flex flex-col gap-1.5">
                {SECTIONS.map((sec) => {
                  const isActive = activeSection === sec.id;
                  const Icon = sec.icon;

                  return (
                    <button
                      key={sec.id}
                      onClick={() => scrollToSection(sec.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "text-muted-foreground border border-transparent hover:text-foreground hover:bg-accent/40"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{sec.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Legal Content */}
          <div className="lg:col-span-9 space-y-6">
            
            {/* Section 1: Unofficial App Disclaimer */}
            <section
              id="disclaimer"
              className="scroll-mt-8 bg-card/25 border border-border/15 hover:border-border/30 rounded-[2rem] p-6 sm:p-8 space-y-4 transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10 text-destructive shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <h2 className="text-base sm:text-lg font-extrabold text-foreground tracking-tight">
                  Unofficial App Disclaimer
                </h2>
              </div>
              
              <div className="border-l-4 border-destructive bg-destructive/5 pl-4 py-3 text-xs sm:text-sm text-foreground/90 leading-relaxed rounded-r-2xl">
                <strong>Notice:</strong> This is an unofficial, community-driven application and is not affiliated with, endorsed by, or maintained by Vellore Institute of Technology (VIT). Deskly operates as a completely unofficial client interface and does not claim any official partner status or authorization from the college.
              </div>
              
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                All data displayed in this application originates directly from the official college student portal (VTOP). It may not always reflect live modifications, system downtimes, or portal updates. Users must verify academic records (such as attendance metrics, marks, grades, and exam schedules) through official college channels.
              </p>
            </section>

            {/* Section 2: No Warranty Disclaimer */}
            <section
              id="warranty"
              className="scroll-mt-8 bg-card/25 border border-border/15 hover:border-border/30 rounded-[2rem] p-6 sm:p-8 space-y-4 transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                  <Scale className="w-5 h-5" />
                </div>
                <h2 className="text-base sm:text-lg font-extrabold text-foreground tracking-tight">
                  Terms of Use &amp; Warranty Limit
                </h2>
              </div>
              
              <div className="border-l-4 border-primary bg-primary/5 pl-4 py-3 text-xs sm:text-sm text-muted-foreground leading-relaxed rounded-r-2xl">
                <strong>Disclaimer of Warranty:</strong> This software is provided &quot;as is&quot; without warranties of any kind, express or implied. Information displayed may be inaccurate, delayed, or unavailable due to network errors, server updates, or portal website structure changes.
              </div>
              
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Under no circumstances shall the developers of Deskly be liable for administrative discrepancies, missed academic schedules, attendance calculation errors, or any other complications resulting from the use of this client application.
              </p>
            </section>

            {/* Section 3: Privacy Policy */}
            <section
              id="privacy"
              className="scroll-mt-8 bg-card/25 border border-border/15 hover:border-border/30 rounded-[2rem] p-6 sm:p-8 space-y-5 transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <h2 className="text-base sm:text-lg font-extrabold text-foreground tracking-tight">
                  Privacy Policy
                </h2>
              </div>

              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Deskly is designed with strict student privacy guidelines in mind:
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 bg-muted/10 border border-border/10 rounded-lg space-y-1.5">
                  <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
                    What Data is Stored?
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Your VTOP credentials (registration number, password) and academic metrics (attendance, marks, grades, timetables, receipts) are stored on your local device.
                  </p>
                </div>

                <div className="p-5 bg-muted/10 border border-border/10 rounded-lg space-y-1.5">
                  <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
                    Where is it Stored?
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Credentials are saved in secure OS-level keychain services (via the keyring API) and cached page data is held in local storage. No cloud servers are used.
                  </p>
                </div>
              </div>
              
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed pt-2">
                <strong>Third-Party Sharing:</strong> No credentials, cookies, keys, session tokens, or student information are ever shared with, transmitted to, or stored on external servers or third-party analytical networks.
              </p>
            </section>

            {/* Section 4: Data Source Attribution */}
            <section
              id="attribution"
              className="scroll-mt-8 bg-card/25 border border-border/15 hover:border-border/30 rounded-[2rem] p-6 sm:p-8 space-y-4 transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                  <Database className="w-5 h-5" />
                </div>
                <h2 className="text-base sm:text-lg font-extrabold text-foreground tracking-tight">
                  Data Source Attribution
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                All academic information displayed within this client app is sourced from the official college student portal (VTOP) as fetched on behalf of the user using their local credentials. This application does not maintain an independent database of student records.
              </p>
            </section>

            {/* Section 5: Open Source License */}
            <section
              id="license"
              className="scroll-mt-8 bg-card/25 border border-border/15 hover:border-border/30 rounded-[2rem] p-6 sm:p-8 space-y-4 transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <h2 className="text-base sm:text-lg font-extrabold text-foreground tracking-tight">
                  Open Source License
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Deskly is released as open-source software under the terms of the MIT License:
              </p>
              <pre className="font-mono text-xs bg-muted/10 border border-border/10 rounded-lg p-5 leading-normal whitespace-pre-wrap text-muted-foreground/85 overflow-x-auto">
{`MIT License

Copyright (c) 2026 Deskly Authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`}
              </pre>
            </section>

          </div>

        </div>

      </div>
    </div>
  );
}
