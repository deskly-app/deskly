import { useState } from "react";
import { useNavigate } from "@/router";
import {
  Scale,
  ShieldAlert,
  Lock,
  Database,
  FileText,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";

type Section = {
  id: string;
  label: string;
  subtitle: string;
  icon: React.ElementType;
  iconColor: string;
  content: React.ReactNode;
};

const SECTIONS: Section[] = [
  {
    id: "disclaimer",
    label: "App Disclaimer",
    subtitle: "Unofficial third-party client",
    icon: ShieldAlert,
    iconColor: "text-destructive",
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-[1.75]">
        <p className="text-foreground/85 font-medium">
          Deskly is an independent, community-built application — not affiliated
          with or endorsed by Vellore Institute of Technology (VIT).
        </p>
        <p>
          All data originates directly from the official VTOP student portal. It
          may not reflect real-time changes, downtimes, or portal updates.
        </p>
        <p className="text-xs text-destructive/70">
          ⚠ Always verify attendance, grades, and schedules through official
          college channels.
        </p>
      </div>
    ),
  },
  {
    id: "warranty",
    label: "Terms of Use",
    subtitle: "Warranty & liability limits",
    icon: Scale,
    iconColor: "text-primary",
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-[1.75]">
        <p>
          This software is provided{" "}
          <span className="font-semibold text-foreground">"as is"</span> without
          warranties of any kind, express or implied.
        </p>
        <p>
          The developers of Deskly are not liable for missed schedules, attendance
          errors, or any complications resulting from use of this application.
        </p>
      </div>
    ),
  },
  {
    id: "privacy",
    label: "Privacy Policy",
    subtitle: "How your data is handled",
    icon: Lock,
    iconColor: "text-primary",
    content: (
      <div className="space-y-4 text-sm text-muted-foreground leading-[1.75]">
        <p>Your data never leaves your device.</p>
        <div className="divide-y divide-border/10">
          {[
            {
              q: "What is stored?",
              a: "VTOP credentials and academic data, stored locally on your device only.",
            },
            {
              q: "Where is it stored?",
              a: "Credentials go into the OS keychain. Academic cache stays in local app storage.",
            },
            {
              q: "Is anything shared?",
              a: "Never. No data is sent to external servers or analytics services.",
            },
          ].map((item) => (
            <div key={item.q} className="py-3 space-y-0.5">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50">
                {item.q}
              </p>
              <p>{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "attribution",
    label: "Data Source",
    subtitle: "Where content comes from",
    icon: Database,
    iconColor: "text-primary",
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-[1.75]">
        <p>
          All academic information is fetched from the official VTOP student
          portal using your own credentials — on your behalf, locally.
        </p>
        <p>
          Deskly does not maintain an independent database of student records.
          Data freshness depends on VTOP availability.
        </p>
      </div>
    ),
  },
  {
    id: "license",
    label: "MIT License",
    subtitle: "Open-source & free forever",
    icon: FileText,
    iconColor: "text-primary",
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground leading-[1.75]">
          Deskly is open-source under the{" "}
          <span className="font-semibold text-foreground">MIT License</span> — one
          of the most permissive licenses available.
        </p>

        <div className="flex flex-wrap gap-2">
          {["Commercial use", "Modification", "Distribution", "Private use"].map(
            (p) => (
              <span
                key={p}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/15"
              >
                ✓ {p}
              </span>
            )
          )}
        </div>

        <p className="text-xs text-muted-foreground/70 leading-relaxed">
          One condition: include the original copyright notice in all copies or
          substantial portions of the Software.
        </p>

        <details className="group">
          <summary className="flex items-center gap-1.5 text-xs font-semibold text-primary cursor-pointer select-none list-none">
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90" />
            View full license text
          </summary>
          <pre className="mt-3 font-mono text-[9.5px] leading-relaxed bg-muted/10 border border-border/10 rounded-md p-4 whitespace-pre-wrap text-muted-foreground/60 overflow-x-auto">
{`MIT License

Copyright (c) 2026 Deskly Authors

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or
sell copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.`}
          </pre>
        </details>
      </div>
    ),
  },
];

export default function LegalPage() {
  const navigate = useNavigate();
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = (id: string) =>
    setOpenId((prev) => (prev === id ? null : id));

  return (
    <div className="h-full w-full overflow-y-auto no-scrollbar bg-background text-foreground">
      <div className="max-w-lg mx-auto px-5 pb-20">

        {/* ── Back button + Header ── */}
        <div className="pt-6 pb-6 space-y-5">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer bg-transparent border-0 p-0 focus:outline-none"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground/40">
              <Scale className="w-3 h-3" />
              Last updated Jun 2026
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground leading-tight">
              Legal &amp; Privacy
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Disclaimers, privacy details, and licensing for Deskly.
            </p>
          </div>
        </div>

        {/* ── Flat accordion ── */}
        <div className="border-t border-border/10">
          {SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const isOpen = openId === sec.id;

            return (
              <div key={sec.id} id={sec.id} className="border-b border-border/10">
                {/* Row */}
                <button
                  onClick={() => toggle(sec.id)}
                  className="w-full flex items-center gap-3 py-4 text-left cursor-pointer bg-transparent border-0 focus:outline-none"
                >
                  <Icon
                    className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                      isOpen ? sec.iconColor : "text-muted-foreground/50"
                    }`}
                  />

                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-[14.5px] font-semibold leading-tight transition-colors ${
                        isOpen ? "text-foreground" : "text-foreground/80"
                      }`}
                    >
                      {sec.label}
                    </p>
                    {!isOpen && (
                      <p className="text-[11.5px] text-muted-foreground/50 mt-0.5 truncate">
                        {sec.subtitle}
                      </p>
                    )}
                  </div>

                  <ChevronRight
                    className={`w-4 h-4 shrink-0 text-muted-foreground/30 transition-transform duration-200 ${
                      isOpen ? "rotate-90" : ""
                    }`}
                  />
                </button>

                {/* Content */}
                <div
                  className={`overflow-hidden transition-all duration-200 ease-in-out ${
                    isOpen ? "max-h-[800px] pb-5" : "max-h-0"
                  }`}
                >
                  <div className="pl-[30px]">{sec.content}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Footer ── */}
        <p className="text-center text-xs text-muted-foreground/35 leading-relaxed pt-8">
          Deskly is an independent open-source project.
          <br />
          Not affiliated with VIT or any official body.
        </p>

      </div>
    </div>
  );
}
