# BRIK Survival Website

Static site for BRIK Survival, deployed automatically through Netlify on every push to the main branch.

## Structure
/
├── index.html
├── netlify.toml
├── Assets/
│   ├── brik-logo.png
│   ├── favicon.ico
│   ├── favicon-16x16.png
│   ├── favicon-32x32.png
│   ├── apple-touch-icon.png
│   ├── android-chrome-512x512.png
│   ├── site.webmanifest
│   └── og-image.png

## Deployment
Pushing to main triggers an automatic Netlify deploy.

Live site: https://briksurvival.com

## Local Editing
Make changes, then:

git add .
git commit -m "Update site"
git push

Netlify redeploys automatically.

## Domain
briksurvival.com is connected through Netlify DNS.
