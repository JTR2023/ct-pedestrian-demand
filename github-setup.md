# GitHub Pages Setup Guide

Follow these steps to host your Connecticut Pedestrian DemandRank web application on GitHub Pages:

## 1. Create a GitHub Repository

1. Go to https://github.com/new
2. Name your repository (e.g., `ct-pedestrian-demand`)
3. Make it public if you want it publicly accessible
4. Click "Create repository"

## 2. Push Your Code to GitHub

From your project directory:

```bash
# Make sure you're in the project directory
cd /Users/tom/my-claude-project

# Add all files to git (except those in .gitignore)
git add .

# Create initial commit
git commit -m "Initial commit"

# Add your GitHub repository as remote
git remote add origin https://github.com/JTR2023/ct-pedestrian-demand.git

# Push the code to GitHub
git push -u origin master
```

## 3. Enable GitHub Pages

1. Go to your repository on GitHub
2. Click on "Settings" tab
3. Scroll down to "GitHub Pages" section
4. Under "Source", select "master branch"
5. Click "Save"
6. Your site will be published at `https://YOUR_USERNAME.github.io/ct-pedestrian-demand/`

## 4. Configure the Application for GitHub Pages

If your repository name isn't at the root of your domain, update paths in the application:

1. Open `index.html` and ensure all file paths include the repository name:
   - Add `<base href="https://JTR2023.github.io/ct-pedestrian-demand/">` in the `<head>` section

2. Update the Google Cloud Storage URLs in `config.js` to point to the correct bucket

## Updating Your Site

After making changes to your code:

```bash
git add .
git commit -m "Description of changes"
git push origin master
```

GitHub Pages will automatically update within a few minutes.

## Notes

- GitHub Pages has a soft limit of about 1GB for repositories
- Large data files should be hosted on Google Cloud Storage
- The API key is visible in your repository, which is fine for this demo but not ideal for production applications