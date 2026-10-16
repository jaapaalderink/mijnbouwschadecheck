import { pages } from "../src/seo.ts";

export function publicOrigin(siteUrl: string | undefined) {
  if (!siteUrl) return null;
  const url = new URL(siteUrl);
  if (
    url.protocol !== "https:" ||
    /^(localhost|127\.|\[::1\])/.test(url.hostname)
  )
    return null;
  return url.origin;
}

export function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}

function initialContent(path: string) {
  const navigation =
    '<nav aria-label="Hoofdnavigatie"><a href="/">De gratis check</a> <a href="/contact">Contact</a></nav>';
  if (path === "/")
    return `${navigation}<main><h1>Mijnbouwschade in Groningen? Begin met duidelijkheid.</h1><p>Scheuren in de muur kunnen vragen oproepen. Met onze gratis check zet je de eerste stap naar persoonlijk advies over fysieke mijnbouwschade in Groningen.</p><h2>Van een vraag naar persoonlijk advies.</h2><h3>Vertel over je woning</h3><p>Beantwoord enkele vragen over je woning en eventuele zichtbare schade.</p><h3>Ontvang een eerste indicatie</h3><p>Na ontvangst van je aanvraag krijg je een voorlopige indicatie. Dit is geen garantie op vergoeding.</p><h3>We nemen contact met je op</h3><p>Iedere aanvraag wordt persoonlijk gecontroleerd voordat we contact opnemen. Vervolgkosten bespreken we vooraf.</p><p>Geen onderdeel van IMG of overheid.</p><noscript>Schakel JavaScript in om de vragenlijst in te vullen.</noscript></main><footer><a href="/privacy">Privacy</a></footer>`;
  if (path === "/contact")
    return `${navigation}<main><h1>Persoonlijk contact.</h1><p>Heb je een vraag over de check of een aanvraag? Neem contact op met ${escapeHtml(process.env.COMPANY_NAME ?? "Mijnbouwschadecheck")}.</p>${process.env.CONTACT_EMAIL ? `<p>E-mailadres: ${escapeHtml(process.env.CONTACT_EMAIL)}</p>` : ""}${process.env.CONTACT_PHONE ? `<p>Telefoonnummer: ${escapeHtml(process.env.CONTACT_PHONE)}</p>` : ""}<p>Onafhankelijk adviesbureau. Geen onderdeel van IMG of overheid. Eventuele kosten voor een vervolgtraject worden vooraf besproken.</p></main>`;
  return "";
}

export function seoHtml(
  html: string,
  path: string,
  siteUrl?: string,
  nonce?: string,
) {
  const page = pages[path];
  const origin = publicOrigin(siteUrl);
  const indexable = !!origin && !!page && path !== "/admin_sander";
  const title = page?.title ?? "Pagina niet gevonden | Mijnbouwschadecheck";
  const description = page?.description ?? "Deze pagina bestaat niet.";
  const url = origin && page ? origin + path : null;
  return html
    .replace(
      '<div id="root"></div>',
      `<div id="root">${initialContent(path)}</div>`,
    )
    .replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/>/,
      `<meta name="description" content="${escapeHtml(description)}" />`,
    )
    .replace(
      /<meta name="robots"[^>]*>/,
      `<meta name="robots" data-public="${!!origin}" content="${indexable ? "index, follow" : "noindex, nofollow"}" />`,
    )
    .replace(
      "</head>",
      `<meta property="og:type" content="website" />
<meta property="og:locale" content="nl_NL" />
<meta property="og:site_name" content="Mijnbouwschadecheck" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
${url ? `<link rel="canonical" href="${escapeHtml(url)}" /><meta property="og:url" content="${escapeHtml(url)}" />` : ""}
${
  indexable && path === "/" && nonce
    ? `<script type="application/ld+json" nonce="${escapeHtml(nonce)}">${JSON.stringify(
        {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Mijnbouwschadecheck",
          url: origin + "/",
          inLanguage: "nl-NL",
          description,
        },
      ).replace(/</g, "\\u003c")}</script>`
    : ""
}
</head>`,
    );
}

export function sitemap(siteUrl?: string) {
  const origin = publicOrigin(siteUrl);
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${origin ? ["/", "/contact", "/privacy"].map((path) => `<url><loc>${escapeHtml(origin + path)}</loc></url>`).join("") : ""}</urlset>`;
}
