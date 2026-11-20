# Nextstep

Personal planner hosted on GitHub Pages with an independent Cloudflare Worker, D1 database, and R2 bucket.

[Open Nextstep](https://ymhomer.github.io/Nextstep/)

Create a new account with email and password. The new deployment uses its own data and recovery codes. The ChatGPT Sites sign-in integration is specific to the original site. Device push and scheduled push reminders require separate Cloudflare setup.

The `Deploy Nextstep` workflow publishes from `main` using the Cloudflare account ID and API token in GitHub Actions repository secrets.
