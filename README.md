# All Projects (NSFW)

A tiny static site that indexes small web projects — tools, games, experiments —
and links to each one. No build step, no framework: just HTML, CSS, and JS. Every
project lives in its own folder and gets one line in `projects.js`; the index
builds itself from that list.

18+ content — nothing here is meant for a general audience.

## Run it locally

The index loads `projects.js` as a normal script, so you can just **double-click
`index.html`** to preview it — no local server needed.

## Add a project

1. Make a folder, e.g. `example/`, and put a self-contained `index.html` in it.
2. Add an entry to the array in `projects.js`:
   ```js
   { slug: "example", title: "Example", description: "One line.", type: "app", added: "2026-08-23" }
   ```
3. Save. The index now shows it.

## Deploy (GitHub Pages)

1. Push this repo to GitHub.
2. Repo **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
3. Choose branch `main`, folder `/ (root)`, and save.
4. Your site goes live at `https://<username>.github.io/<repo>/` in a minute or two.
