/** Score-card text + PNG generation (client only). Sharing is always user-initiated. */
export type CardKind = "daily" | "weekly" | "ielts" | "interview" | "challenge" | "referral";

export interface CardData {
  title?: string;
  name?: string;
  score?: number;
  scores?: { grammar?: number | null; fluency?: number | null; vocabulary?: number | null; pronunciation?: number | null };
  streak?: number;
  band?: number | null;
  target?: number | null;
  bands?: Partial<Record<"listening" | "reading" | "writing" | "speaking", number | null>>;
  lines?: string[];
  referralUrl?: string;
}

export function appUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://speakup.example";
}

export function shareText(kind: CardKind, d: CardData): string {
  const L: string[] = [];
  const s = d.scores ?? {};
  const fmt = (v: number | null | undefined) => (v === null || v === undefined ? "—" : String(v));
  switch (kind) {
    case "daily":
    case "challenge":
      L.push(kind === "challenge" ? `🏅 ${d.title ?? "30-Day Challenge"}` : "MY SPEAKUP AI JOURNEY");
      if (d.score !== undefined) L.push(`Daily English Score: ${d.score}/100`);
      L.push(`Grammar: ${fmt(s.grammar)}`, `Fluency: ${fmt(s.fluency)}`, `Vocabulary: ${fmt(s.vocabulary)}`);
      if (s.pronunciation !== undefined && s.pronunciation !== null) L.push(`Pronunciation (est.): ${s.pronunciation}`);
      if (d.streak) L.push(`English Streak: ${d.streak} Days 🔥`);
      break;
    case "weekly":
      L.push("📈 MY WEEKLY ENGLISH PROGRESS", ...(d.lines ?? []));
      break;
    case "ielts":
      L.push("🎓 MY IELTS PRACTICE PROGRESS");
      if (d.band !== null && d.band !== undefined) L.push(`Estimated overall band: ${d.band.toFixed(1)}`);
      for (const [k, v] of Object.entries(d.bands ?? {})) if (v !== null && v !== undefined) L.push(`${k[0].toUpperCase() + k.slice(1)}: ${v.toFixed(1)}`);
      if (d.target) L.push(`Target: ${d.target.toFixed(1)}`);
      L.push("(Practice estimate, not an official IELTS score)");
      break;
    case "interview":
      L.push("💼 MOCK INTERVIEW COMPLETE", d.title ?? "", `Score: ${d.score ?? "—"}/100`);
      break;
    case "referral":
      L.push("I'm practising English speaking every day with SpeakUp AI — free AI coach, IELTS practice and interview simulator. Join me! 🚀");
      break;
  }
  L.push("", "#SpeakUpAI", d.referralUrl ?? appUrl());
  return L.filter((x, i) => x !== "" || i > 0).join("\n");
}

export function whatsappUrl(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Draws a 1080x1350 PNG score card with canvas. */
export async function renderCard(kind: CardKind, d: CardData): Promise<Blob> {
  const W = 1080;
  const H = 1350;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#2747e0");
  grad.addColorStop(1, "#1e2f71");
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(255,154,31,.18)";
  g.beginPath();
  g.arc(W - 120, 140, 260, 0, Math.PI * 2);
  g.fill();

  const font = (w: number, s: number) => `${w} ${s}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
  g.fillStyle = "#fff";
  g.font = font(800, 54);
  g.fillText("SpeakUp AI", 80, 130);
  g.font = font(500, 30);
  g.fillStyle = "#bfd2ff";
  g.fillText("Stop Hesitating. Start Speaking.", 80, 180);

  const heading =
    kind === "ielts" ? "IELTS PRACTICE PROGRESS" : kind === "interview" ? "MOCK INTERVIEW" : kind === "weekly" ? "WEEKLY PROGRESS" : kind === "referral" ? "JOIN ME ON SPEAKUP AI" : kind === "challenge" ? (d.title ?? "30-DAY CHALLENGE").toUpperCase() : "MY SPEAKUP AI JOURNEY";
  g.fillStyle = "#fff";
  g.font = font(800, 56);
  wrap(g, heading, 80, 320, W - 160, 66);
  if (d.name) {
    g.font = font(500, 34);
    g.fillStyle = "#dbe6ff";
    g.fillText(d.name, 80, 440);
  }

  // Big number
  const big = kind === "ielts" ? (d.band !== null && d.band !== undefined ? d.band.toFixed(1) : "—") : d.score !== undefined ? String(d.score) : "";
  if (big) {
    g.fillStyle = "#ffb547";
    g.font = font(900, 220);
    g.fillText(big, 80, 700);
    g.fillStyle = "#dbe6ff";
    g.font = font(600, 40);
    g.fillText(kind === "ielts" ? "estimated band" : "/ 100", 80 + g.measureText(big).width * 0 + 10, 760);
  }

  let y = big ? 860 : 560;
  const rows: Array<[string, number | null | undefined, number]> = [];
  if (kind === "ielts") for (const [k, v] of Object.entries(d.bands ?? {})) rows.push([k[0].toUpperCase() + k.slice(1), v, 9]);
  else if (d.scores) {
    rows.push(["Grammar", d.scores.grammar, 100], ["Fluency", d.scores.fluency, 100], ["Vocabulary", d.scores.vocabulary, 100]);
    if (d.scores.pronunciation !== null && d.scores.pronunciation !== undefined) rows.push(["Pronunciation (est.)", d.scores.pronunciation, 100]);
  }
  for (const [label, v, max] of rows) {
    g.fillStyle = "#fff";
    g.font = font(600, 36);
    g.fillText(label, 80, y);
    g.textAlign = "right";
    g.fillText(v === null || v === undefined ? "—" : max === 9 ? v.toFixed(1) : String(v), W - 80, y);
    g.textAlign = "left";
    g.fillStyle = "rgba(255,255,255,.2)";
    roundRect(g, 80, y + 18, W - 160, 16, 8);
    if (v !== null && v !== undefined) {
      g.fillStyle = "#14b88a";
      roundRect(g, 80, y + 18, ((W - 160) * v) / max, 16, 8);
    }
    y += 92;
  }
  for (const line of d.lines ?? []) {
    g.fillStyle = "#fff";
    g.font = font(600, 38);
    g.fillText(line, 80, y);
    y += 64;
  }
  if (d.streak) {
    g.fillStyle = "#ffb547";
    g.font = font(800, 46);
    g.fillText(`🔥 ${d.streak}-day English streak`, 80, Math.min(y + 30, H - 170));
  }
  g.fillStyle = "#bfd2ff";
  g.font = font(600, 34);
  g.fillText("#SpeakUpAI", 80, H - 80);
  g.textAlign = "right";
  g.font = font(500, 26);
  g.fillText(kind === "ielts" ? "Practice estimate — not an official IELTS score" : "Automated practice estimate", W - 80, H - 80);
  return new Promise((res) => c.toBlob((b) => res(b!), "image/png"));
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, Math.max(w, 0.1), h, r);
  g.fill();
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  const words = text.split(" ");
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, x, y);
      line = w;
      y += lh;
    } else line = test;
  }
  g.fillText(line, x, y);
}
