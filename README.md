# Amplify Engineering – Product Roadmap Progress Dashboard (Netlify)

One page with two sections:

- **Engineering Release Tracker**: built from the Amplify Engineering Release Work Tracker workbook.
- **Engineering Work (Initiatives & Epics) Progress View**: pulled from the Jira filter "Ongoing Work For Reporting" each time the page opens, and again when someone clicks **Refresh**.

## What's in this folder

| Path | What it does |
| --- | --- |
| `public/index.html` | The dashboard page |
| `public/xlsx.full.min.js` | Library that reads the Excel tracker in the browser |
| `netlify/functions/jira.mjs` | `/api/jira`: returns the saved Jira pull; `?fresh=1` (the Refresh button) pulls from Jira now |
| `netlify/functions/jira-hourly.mjs` | Scheduled job: pulls from Jira every hour and saves it, so the page always opens with numbers under an hour old |
| `netlify/lib/jira-pull.mjs` | The shared Jira logic both use |
| `netlify/functions/tracker.mjs` | `/api/tracker`: serves the latest uploaded tracker and accepts uploads with the upload key |
| `netlify.toml`, `package.json` | Netlify build settings |

## Deploy (about 10 minutes, one time)

The functions need a real deploy. Drag-and-drop on Netlify Drop only publishes static files, so use one of these two options.

**Option A: Netlify CLI** (needs Node.js installed)

1. Open a terminal in this folder.
2. Run `npm install` and then `npm install -g netlify-cli`.
3. Run `netlify login`.
4. Run `netlify init` and choose **Create & configure a new site**.
   For the site name, enter `amplify-engineering-product-roadmap-progress`.
   The site will be at `https://amplify-engineering-product-roadmap-progress.netlify.app`.
5. Set the settings below, then run `netlify deploy --prod`.

**Option B: GitHub**

1. Push this folder to a GitHub repository.
2. In Netlify, choose **Add new site > Import an existing project** and pick the repository. The build settings come from `netlify.toml`.
3. Rename the site under **Site configuration > Change site name**.

## Settings

Go to **Netlify > Site configuration > Environment variables** and add these:

| Name | Value |
| --- | --- |
| `JIRA_EMAIL` | The Atlassian account email that owns the API token |
| `JIRA_API_TOKEN` | Create one at https://id.atlassian.com/manage-profile/security/api-tokens |
| `UPLOAD_KEY` | Any passphrase you choose. Editors type it when they upload a newer tracker. Leave it unset to turn uploads off. |

Optional settings:

- `JIRA_SITE` (default `amppf.atlassian.net`)
- `JIRA_FILTER` (default `Ongoing Work For Reporting`)

After changing settings, redeploy with `netlify deploy --prod`, or use **Deploys > Trigger deploy** in Netlify.

Use a Jira account that can see every project in the filter. Everyone who opens the site sees what that account can see.

## Day to day

- **Jira numbers**: the hourly job saves a fresh pull every hour, and the page opens with it. Anyone can click **↻ Refresh** to pull straight from Jira, which also updates the saved copy for everyone. If Jira is slow, the page shows the last saved pull with a note. The hourly job only runs on the published production site; you can see its runs under **Logs > Functions > jira-hourly**.
- **Release tracker**: after editing the Excel file, click **Upload newer tracker** on the page, pick the saved file, and enter the upload key. Everyone sees it on their next load. Until the first upload, the page shows the copy built into it.
- **Download report**: saves the page you're viewing as a dated HTML file to attach to emails.

## Privacy

Anyone with the site address can see the dashboard, including Jira initiative and epic names and owners. To limit who can view it, turn on **Site configuration > Access & security > Password protection**, or Netlify Identity. Both are available on paid Netlify plans.
