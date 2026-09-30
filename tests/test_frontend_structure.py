"""Structure contract for index.html: one document head, Value Compass shell adoption."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / 'index.html').read_text(encoding='utf-8')
HEAD = HTML[:HTML.index('</head>')]
BODY = HTML[HTML.index('<body>') + len('<body>'):]


class DocumentTests(unittest.TestCase):
    def test_single_html_and_head(self):
        self.assertEqual(len(re.findall(r'<html\b', HTML)), 1)
        self.assertEqual(len(re.findall(r'<head\b', HTML)), 1)
        self.assertEqual(HTML.count('</head>'), 1)
        self.assertEqual(len(re.findall(r'<body\b', HTML)), 1)

    def test_each_script_and_stylesheet_loads_once(self):
        scripts = re.findall(r'<script[^>]*\bsrc="([^"]+)"', HTML)
        styles = re.findall(r'<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"', HTML)
        self.assertEqual(len(scripts), len(set(scripts)), scripts)
        self.assertEqual(len(styles), len(set(styles)), styles)
        self.assertTrue(all(re.search(rf'<script[^>]*src="{re.escape(s)}"[^>]*\bdefer\b|<script[^>]*\bdefer\b[^>]*src="{re.escape(s)}"', HTML)
                            for s in scripts), 'classic scripts must be deferred')

    def test_brand_is_value_compass(self):
        self.assertIn('<title>All About Gold · Value Compass</title>', HTML)
        self.assertNotRegex(HTML, r'(?i)value invest\b')
        self.assertIn('VALUE COMPASS', HTML)

    def test_data_endpoint_marker_for_pages_build(self):
        self.assertEqual(HTML.count('<meta name="gold-data-url" content="/api/gold">'), 1)


class EcosystemShellTests(unittest.TestCase):
    def test_theme_boot_block_runs_before_any_stylesheet(self):
        self.assertEqual(HTML.count('<!-- vc:theme-boot -->'), 1)
        self.assertEqual(HTML.count('<!-- /vc:theme-boot -->'), 1)
        boot = HEAD.index('<!-- vc:theme-boot --><script>')
        self.assertLess(boot, HEAD.index('<link rel="stylesheet"'))
        block = HEAD[boot:HEAD.index('<!-- /vc:theme-boot -->')]
        # Inlined byte-for-byte by value-invest scripts/sync-ecosystem.mjs.
        self.assertIn('vc-theme-boot v1', block)
        self.assertIn("p.get('theme')", block)
        self.assertIn("localStorage.getItem('theme')", block)
        self.assertIn('prefers-color-scheme: dark', block)

    def test_tokens_before_own_css_and_shell_script(self):
        tokens = HEAD.index('href="./static/vc-tokens.css?v=')
        self.assertLess(tokens, HEAD.index('href="static/css/style.css"'))
        self.assertRegex(HEAD, r'<script defer src="\./static/vc-shell\.js\?v=[^"]+"></script>')
        self.assertLess(HEAD.index('vc-shell.js'), HEAD.index('static/js/app.js'))

    def test_shell_is_first_in_body_with_hub_fallback(self):
        self.assertTrue(BODY.lstrip().startswith('<vc-shell tool="all-about-gold">'))
        shell = BODY[:BODY.index('</vc-shell>')]
        self.assertIn('href="https://ducklove.duckdns.org:3691/"', shell)
        self.assertIn('Value Compass ↗', shell)
        header = BODY[BODY.index('<header'):BODY.index('</header>')]
        self.assertNotIn('hub-link', header, 'the shell replaces the header hub link')

    def test_vendored_assets_are_present_and_marked(self):
        for path, marker in (('static/vc-shell.js', 'do not edit copies'),
                             ('static/vc-tokens.css', 'do not edit copies'),
                             ('scripts/vc_publish.py', 'vendored from value-invest')):
            text = (ROOT / path).read_text(encoding='utf-8')
            self.assertIn(marker, text, path)

    def test_direction_colours_and_font_alias_shared_tokens(self):
        css = (ROOT / 'static/css/style.css').read_text(encoding='utf-8')
        root, dark = css.splitlines()[:2]
        self.assertIn('--up:var(--vc-up);--down:var(--vc-down)', root)
        self.assertIn('--font:var(--vc-font-sans)', root)
        self.assertNotIn('--up:', dark)
        self.assertNotIn('--down:', dark)
        self.assertIn('--primary:#3b82f6', dark)

    def test_cross_links_to_sibling_tools(self):
        self.assertIn('data-vc-tool="gold_gap" data-vc-asset="gold" '
                      'href="https://ducklove.github.io/gold_gap/?asset=gold"', HTML)
        research = (ROOT / 'static/js/research.js').read_text(encoding='utf-8')
        self.assertIn('data-vc-tool="eiayn"', research)
        self.assertIn('https://ducklove.github.io/eiayn/?code=', research)
        app = (ROOT / 'static/js/app.js').read_text(encoding='utf-8')
        self.assertIn('window.VCShell.setTheme(theme)', app)
        self.assertIn("addEventListener('vc:themechange'", app)

    def test_embed_follows_the_deep_link_contract(self):
        # ?embed=0 / ?embed=false is not embed mode (same rule as vc-shell and the boot block).
        app = (ROOT / 'static/js/app.js').read_text(encoding='utf-8')
        self.assertNotIn("params.has('embed')", app)
        self.assertIn("hasAttribute('data-embed')", app)
        self.assertIn("embedParam !== '0' && embedParam !== 'false'", app)

    def test_cross_links_use_the_shared_link_token(self):
        css = (ROOT / 'static/css/style.css').read_text(encoding='utf-8')
        self.assertIn('.ecosystem-link{color:var(--vc-link,var(--primary))', css)


if __name__ == '__main__':
    unittest.main()
