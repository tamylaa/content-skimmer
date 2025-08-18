<#
deploy-diagnostics.ps1
Runs a set of non-destructive checks to diagnose Cloudflare/Wrangler authentication
and configuration issues for CI deployments.

Usage:
  - Run in PowerShell from project root:
      .\deploy-diagnostics.ps1
  - To attempt a real deploy (NOT recommended here), pass -AttemptDeploy.

This script does NOT echo secrets. It reads CLOUDFLARE_API_TOKEN from the environment or
prompts for it if missing (secret entry won't be stored). It will call Cloudflare API
/ accounts endpoint to confirm token permissions.
#>

param(
    [switch]$AttemptDeploy = $false
)

function Write-Header($text){
    Write-Host "`n===== $text =====`n" -ForegroundColor Cyan
}

function SafeReadToken(){
    if ($env:CLOUDFLARE_API_TOKEN) {
        return $env:CLOUDFLARE_API_TOKEN
    }
    Write-Host "CLOUDFLARE_API_TOKEN not found in environment. You may paste it now (it will not be stored)." -ForegroundColor Yellow
    $t = Read-Host -AsSecureString "Enter Cloudflare API token (input hidden)" 
    return [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($t))
}

# 1) Basic environment checks
Write-Header "Environment checks"
Write-Host "Project path: $((Get-Location).Path)"
Write-Host "Node.js available:" -NoNewline
$node = (Get-Command node -ErrorAction SilentlyContinue)
if ($node) { Write-Host " Yes ($($node.Source))" } else { Write-Host " No" -ForegroundColor Red }

Write-Host "npx available:" -NoNewline
$npx = (Get-Command npx -ErrorAction SilentlyContinue)
if ($npx) { Write-Host " Yes ($($npx.Source))" } else { Write-Host " No" -ForegroundColor Red }

Write-Host "CLOUDFLARE_API_TOKEN present in env:" -NoNewline
if ($env:CLOUDFLARE_API_TOKEN) { Write-Host " Yes (hidden)" } else { Write-Host " No" -ForegroundColor Yellow }

Write-Host "CLOUDFLARE_ACCOUNT_ID present in env:" -NoNewline
if ($env:CLOUDFLARE_ACCOUNT_ID) { Write-Host " Yes ($($env:CLOUDFLARE_ACCOUNT_ID))" } else { Write-Host " No" -ForegroundColor Yellow }

# 2) Read wrangler.toml account_id values
Write-Header "wrangler.toml checks"
$wrangler = Join-Path (Get-Location) 'wrangler.toml'
if (Test-Path $wrangler) {
    Write-Host "Found wrangler.toml"
    $content = Get-Content $wrangler -Raw
    $acctMatches = Select-String -InputObject $content -Pattern 'account_id\s*=\s*"(?<id>[0-9a-fA-F]+)"' -AllMatches
    if ($acctMatches.Matches.Count -gt 0) {
        Write-Host "account_id entries found:" -ForegroundColor Green
        foreach ($m in $acctMatches.Matches) { Write-Host " - $($m.Groups['id'].Value)" }
    } else { Write-Host "No account_id found in wrangler.toml" -ForegroundColor Yellow }
} else {
    Write-Host "No wrangler.toml found in project root" -ForegroundColor Red
}

# 3) Wrangler whoami
Write-Header "Wrangler identity check"
try {
    # Some wrangler versions don't accept --verbose; call whoami directly
    $whoami = & npx wrangler whoami 2>&1
    Write-Host $whoami
} catch {
    Write-Host "npx wrangler whoami failed: $_" -ForegroundColor Red
}

# 4) Test Cloudflare token against /accounts
Write-Header "Cloudflare token -> /accounts API test"
$token = SafeReadToken
if (-not $token) { Write-Host "No token provided. Skipping API tests." -ForegroundColor Yellow; exit 2 }

try {
    $hdr = @{ Authorization = "Bearer $token"; 'Content-Type' = 'application/json' }
    $resp = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/accounts" -Headers $hdr -Method Get -ErrorAction Stop
    if ($resp.success -eq $true) {
        Write-Host "Token is valid and returned accounts:" -ForegroundColor Green
        foreach ($acct in $resp.result) { Write-Host " - $($acct.id) : $($acct.name)" }
    } else {
        Write-Host "Token test returned non-success response:" -ForegroundColor Red
        $resp | ConvertTo-Json | Write-Host
    }
} catch {
    Write-Host "Cloudflare API /accounts request failed: $_" -ForegroundColor Red
}

# 5) Cross-check wrangler.toml account id with token accounts
Write-Header "Cross-check account ids"
if ((Test-Path $wrangler) -and ($resp -ne $null) -and ($resp.result)) {
    $ids = $resp.result | ForEach-Object { $_.id }
    $acctMatches = Select-String -InputObject $content -Pattern 'account_id\s*=\s*"(?<id>[0-9a-fA-F]+)"' -AllMatches
    foreach ($m in $acctMatches.Matches) {
        $id = $m.Groups['id'].Value
        if ($ids -contains $id) {
            Write-Host "wrangler.toml account_id $id is accessible by the token" -ForegroundColor Green
        } else {
            Write-Host "wrangler.toml account_id $id is NOT accessible by the token" -ForegroundColor Red
        }
    }
}

# 6) Optional: attempt a dry-run deploy (if user passed -AttemptDeploy)
if ($AttemptDeploy) {
    Write-Header "Attempting a non-destructive deploy check"
    try {
        Write-Host "Running: npx wrangler deploy --env production --dry-run (if supported)"
        & npx wrangler deploy --env production --dry-run 2>&1 | Write-Host
    } catch {
        Write-Host "Deploy attempt failed or --dry-run not supported. Error: $_" -ForegroundColor Red
    }
}

Write-Header "Diagnostics complete"
Write-Host "If account mismatch or token invalid, create a new API token with these scopes:"
Write-Host " - Account.Workers Scripts: Edit"
Write-Host " - Account.Workers Builds Configuration: Edit"
Write-Host " - Account.Account Settings: Read"
Write-Host "Then update your GitHub secret CLOUDFLARE_API_TOKEN with the new token value."

exit 0
