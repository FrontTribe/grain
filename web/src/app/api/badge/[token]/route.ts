import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// Rough width of a string at the badge font size, for layout.
function textWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += /[iIl.:'|]/.test(ch) ? 3.2 : /[mwMW%]/.test(ch) ? 9 : 6.4;
  return w;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// A flat, grain-branded badge: dark "grain" label + a message colored by AI level.
function badgeSVG(label: string, message: string, color: string): string {
  const pad = 6;
  const lw = Math.round(textWidth(label) + pad * 2);
  const mw = Math.round(textWidth(message) + pad * 2);
  const w = lw + mw;
  const lx = (lw / 2) * 10;
  const mx = (lw + mw / 2) * 10;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${esc(label)}: ${esc(message)}">
  <title>${esc(label)}: ${esc(message)}</title>
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="r"><rect width="${w}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${lw}" height="20" fill="#1A1712"/>
    <rect x="${lw}" width="${mw}" height="20" fill="${color}"/>
    <rect width="${w}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,DejaVu Sans,sans-serif" font-size="110" text-rendering="geometricPrecision">
    <text x="${lx}" y="150" transform="scale(.1)" fill="#000" fill-opacity=".25">${esc(label)}</text>
    <text x="${lx}" y="140" transform="scale(.1)">${esc(label)}</text>
    <text x="${mx}" y="150" transform="scale(.1)" fill="#000" fill-opacity=".25">${esc(message)}</text>
    <text x="${mx}" y="140" transform="scale(.1)">${esc(message)}</text>
  </g>
</svg>`;
}

function svgResponse(svg: string): Response {
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml;charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=86400",
    },
  });
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const clean = token.replace(/\.svg$/, "");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return svgResponse(badgeSVG("grain", "n/a", "#6E6656"));

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await supabase.rpc("badge_data", { p_token: clean });
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return svgResponse(badgeSVG("grain", "not found", "#6E6656"));

  const ai = Math.round(Number(row.ai));
  // viridian (human-leaning) → sienna (AI-heavy)
  const color = ai >= 60 ? "#B0511C" : ai >= 40 ? "#C56A2C" : "#1F6E5B";
  return svgResponse(badgeSVG("grain", `${ai}% AI-assisted`, color));
}
