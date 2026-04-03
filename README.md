# Punchh Audit log search helper (Chrome Extension)

This extension performs deep/global search across paginated Punchh audit log tables by:
- scanning the current page for a keyword,
- auto-clicking the **Next** button,
- waiting for new data to load,
- stopping when a match is found or the last page is reached.

## Files

- `manifest.json` - extension metadata and permissions.
- `content.js` - injected page UI and search traversal logic.

## Install (Developer Mode)

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder: `global-table-searcher-extension`.

## Usage

1. Open the target dashboard page on `dashboard.punchh.com`.
2. Click **Audit search** in the top-right to open the helper panel (or it opens automatically when a multi-page search resumes after navigation).
3. Enter **Keyword**, set **Delay per page (ms)** if needed, then click **Start Search**.
4. Click **Hide** to collapse the panel; the **Audit search** button stays available to reopen it.
5. Click **Stop** any time to halt a running search.

## Demo

Check out the demo video here: [demo.mov](https://youtu.be/yT-i3q90SeE)

## Notes

- If pagination updates with AJAX, the script waits for row content changes before scanning again.
- Increase delay to avoid rate-limiting or temporary blocking.
- Next-page and row detection use built-in defaults tuned for typical Punchh audit tables.
