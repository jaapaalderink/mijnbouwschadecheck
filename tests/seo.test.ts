import test from "node:test";
import assert from "node:assert/strict";
import { seoHtml, sitemap, publicOrigin } from "../server/seo.ts";

const origin = "https://www.mijnbouwschadecheck.nl";
const template =
  '<html><head><title>Old</title><meta name="description" content="Old" /><meta name="robots" content="noindex, nofollow" /></head><body><div id="root"></div></body></html>';

test("SEO uses the configured public origin and route-specific metadata", () => {
  const html = seoHtml(template, "/contact", origin, "test-nonce");
  assert.match(html, /Contact over mijnbouwschade in Groningen/);
  assert.match(
    html,
    /rel="canonical" href="https:\/\/www.mijnbouwschadecheck.nl\/contact"/,
  );
  assert.match(html, /content="index, follow"/);
  const home = seoHtml(template, "/", origin, "test-nonce");
  const json = home.match(/<script[^>]*>(.*?)<\/script>/s)![1];
  assert.equal(JSON.parse(json).url, origin + "/");
  assert.match(home, /nonce="test-nonce"/);
  assert.match(home, /<h1>Mijnbouwschade in Groningen/);
  assert.match(home, /Schakel JavaScript in om de vragenlijst/);
});

test("local development and administration stay out of search results", () => {
  assert.equal(publicOrigin("http://localhost:3001"), null);
  assert.match(
    seoHtml(template, "/", "http://localhost:3001"),
    /content="noindex, nofollow"/,
  );
  assert.doesNotMatch(
    seoHtml(template, "/", "http://localhost:3001"),
    /rel="canonical"/,
  );
  assert.match(
    seoHtml(template, "/beheer", origin),
    /content="noindex, nofollow"/,
  );
  assert.doesNotMatch(sitemap(origin), /beheer|localhost/);
  assert.equal((sitemap(origin).match(/<loc>/g) ?? []).length, 3);
  assert.doesNotMatch(sitemap("http://localhost:3001"), /<loc>/);
});
