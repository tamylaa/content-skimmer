# Token comparison script - shows the same analysis as CI
# Run this to see how your local token compares to what GitHub Actions sees

Write-Host "=== Local Token Analysis ===" -ForegroundColor Green

# Prompt for token (hidden input)
$secureToken = Read-Host "Paste your Cloudflare API token" -AsSecureString
$TOKEN_RAW = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken))

Write-Host "`n== Raw token characteristics (masked) =="
Write-Host "Raw token length: $($TOKEN_RAW.Length)"
Write-Host "Raw token first 8 chars (masked): $('*' * [Math]::Min(8, $TOKEN_RAW.Length))"
Write-Host "Raw token last 8 chars (masked): $('*' * [Math]::Min(8, $TOKEN_RAW.Length))"

# Check for common issues
if ($TOKEN_RAW.StartsWith('"')) { Write-Host "⚠️  Token starts with quote" -ForegroundColor Yellow }
if ($TOKEN_RAW.EndsWith('"')) { Write-Host "⚠️  Token ends with quote" -ForegroundColor Yellow }
if ($TOKEN_RAW.StartsWith('Bearer')) { Write-Host "⚠️  Token starts with 'Bearer'" -ForegroundColor Yellow }
if ($TOKEN_RAW.Contains("`r")) { Write-Host "⚠️  Token contains CR (\r)" -ForegroundColor Yellow }
if ($TOKEN_RAW.Contains("`n")) { Write-Host "⚠️  Token contains LF (\n)" -ForegroundColor Yellow }

# Sanitize (PowerShell equivalent of the bash sanitization)
$TOKEN_SANITIZED = $TOKEN_RAW -replace '[\r\n\t ]', '' -replace '^"', '' -replace '"$', '' -replace '^Bearer\s*', ''

Write-Host "`n== After sanitization =="
Write-Host "Sanitized token length: $($TOKEN_SANITIZED.Length)"
Write-Host "Sanitized first 8 chars (masked): $('*' * [Math]::Min(8, $TOKEN_SANITIZED.Length))"
Write-Host "Sanitized last 8 chars (masked): $('*' * [Math]::Min(8, $TOKEN_SANITIZED.Length))"

# Test the token
Write-Host "`n== Testing token with Cloudflare API =="
try {
    $headers = @{
        'Authorization' = "Bearer $TOKEN_SANITIZED"
        'Content-Type' = 'application/json'
    }
    $response = Invoke-RestMethod -Uri 'https://api.cloudflare.com/client/v4/user/tokens/verify' -Headers $headers -Method Get
    if ($response.success) {
        Write-Host "✅ Token verification succeeded" -ForegroundColor Green
    } else {
        Write-Host "❌ Token verification failed" -ForegroundColor Red
        Write-Host "Response: $($response | ConvertTo-Json -Depth 3)"
    }
} catch {
    Write-Host "❌ Token verification failed with error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Compare this output with GitHub Actions logs ===" -ForegroundColor Cyan
Write-Host "If the lengths or characteristics differ, the GitHub secret needs to be updated." -ForegroundColor Cyan

# Clear sensitive variables
$TOKEN_RAW = $null
$TOKEN_SANITIZED = $null
$secureToken = $null
