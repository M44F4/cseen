# Security

cseen turns scenes into SVG, and it imports SVG files (`plane({ svg })`, `parseSvg`). Imported files are sanitised: scripts, event handlers and external references are removed. If you find a way past that, or any other way for a scene or an imported file to run script or load something from outside, please report it.

The docs site's playground runs visitors' code, so it is built to keep that code away from the page: it runs in an iframe with `sandbox="allow-scripts"` only (no access to the site's DOM, storage or cookies, no navigation, no popups), under a policy that blocks every network request, and code that arrives in a share link is not run until the visitor presses Run. A way out of that sandbox is in scope for a report.

Do not open a public issue. Use GitHub's private vulnerability reporting on this repository (Security tab, "Report a vulnerability"). This is a solo-maintained project, so replies may take a while, but every report is read.

Until version 1.0 only the latest version is supported.
