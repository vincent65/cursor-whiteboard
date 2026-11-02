#!/usr/bin/env bash
# Re-render diagrams, PDF and DOCX for the tech spec.
# One-time setup: mkdir -p /tmp/mmdc-tool && cd /tmp/mmdc-tool && PUPPETEER_SKIP_DOWNLOAD=1 npm i @mermaid-js/mermaid-cli puppeteer
set -euo pipefail
cd "$(dirname "$0")"
MMDC=${MMDC:-/tmp/mmdc-tool/node_modules/.bin/mmdc}
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for f in diagrams/*.mmd; do
  "$MMDC" -p diagrams/puppeteer.json -c diagrams/mermaid-config.json -C diagrams/style.css -i "$f" -o "${f%.mmd}.png" -b white -s 3 -q
done
pandoc tech-spec.md -s --css print.css --embed-resources -o /tmp/tech-spec.html
"$CHROME" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf=tech-spec.pdf "file:///tmp/tech-spec.html" 2>/dev/null
pandoc tech-spec.md -o tech-spec.docx
echo "built tech-spec.pdf and tech-spec.docx"
