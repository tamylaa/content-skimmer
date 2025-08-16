# Build, test, and deploy Cloudflare Worker (content-skimmer)
# Usage: .\deploy-worker.ps1

# 1. Install dependencies
Write-Host "Installing dependencies..."
npm install

# 2. Build TypeScript
Write-Host "Building project..."
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed. Aborting."
    exit 1
}

# 3. (Optional) Test locally with Wrangler
echo "To test locally, run: npx wrangler dev"

# 4. Deploy to Cloudflare Workers
Write-Host "Deploying to Cloudflare Workers..."
npx wrangler deploy
if ($LASTEXITCODE -ne 0) {
    Write-Error "Deployment failed."
    exit 1
}

Write-Host "Deployment complete!"
