param(
  [Parameter(Mandatory = $true)]
  [string]$ApiBase,
  [string]$WebBase,
  [string]$LoginEmail,
  [string]$LoginPassword
)

function Normalize-Base([string]$url) {
  $u = $url.Trim()
  if ($u.EndsWith("/")) { $u = $u.TrimEnd("/") }
  return $u
}

function Add-Result([string]$name, [bool]$ok, [string]$detail) {
  $script:results += [pscustomobject]@{
    Check = $name
    Ok = $ok
    Detail = $detail
  }
}

function Try-GetJson([string]$url) {
  try {
    $resp = Invoke-RestMethod -Method Get -Uri $url -TimeoutSec 20 -ErrorAction Stop
    return @{ Ok = $true; Data = $resp; Error = $null }
  } catch {
    return @{ Ok = $false; Data = $null; Error = $_ }
  }
}

function Try-GetStatus([string]$url) {
  try {
    $resp = Invoke-WebRequest -Method Get -Uri $url -TimeoutSec 20 -ErrorAction Stop
    return @{ Ok = $true; Status = $resp.StatusCode; Headers = $resp.Headers; Error = $null }
  } catch {
    $status = $null
    $headers = $null
    if ($_.Exception.Response) {
      $headers = $_.Exception.Response.Headers
      if ($_.Exception.Response.StatusCode) {
        $status = $_.Exception.Response.StatusCode.value__
      }
    }
    return @{ Ok = $false; Status = $status; Headers = $headers; Error = $_ }
  }
}

function Try-Options([string]$url, [hashtable]$headers) {
  try {
    $resp = Invoke-WebRequest -Method Options -Uri $url -Headers $headers -TimeoutSec 20 -ErrorAction Stop
    return @{ Ok = $true; Status = $resp.StatusCode; Headers = $resp.Headers; Error = $null }
  } catch {
    $status = $null
    $respHeaders = $null
    if ($_.Exception.Response) {
      $respHeaders = $_.Exception.Response.Headers
      if ($_.Exception.Response.StatusCode) {
        $status = $_.Exception.Response.StatusCode.value__
      }
    }
    return @{ Ok = $false; Status = $status; Headers = $respHeaders; Error = $_ }
  }
}

$results = @()
$api = Normalize-Base $ApiBase
$web = ""
if ($WebBase) { $web = Normalize-Base $WebBase }

Write-Host "Running post-deploy checks for API: $api"
if ($web) { Write-Host "Web: $web" }

$health = Try-GetJson "$api/health"
if ($health.Ok -and $health.Data.ok -eq $true) {
  Add-Result "/health" $true "ok=true"
} else {
  $detail = if ($health.Ok) { "ok flag not true" } else { "request failed" }
  Add-Result "/health" $false $detail
}

$ready = Try-GetJson "$api/ready"
if ($ready.Ok -and $ready.Data.ok -eq $true) {
  $db = $ready.Data.checks.db
  $redis = $ready.Data.checks.redis
  Add-Result "/ready" $true "db=$db, redis=$redis"
} else {
  $detail = if ($ready.Ok) {
    $db = $ready.Data.checks.db
    $redis = $ready.Data.checks.redis
    "ok flag not true (db=$db, redis=$redis)"
  } else {
    "request failed"
  }
  Add-Result "/ready" $false $detail
}

$apiRoot = Try-GetStatus "$api/api"
if (-not $apiRoot.Ok -and $apiRoot.Status -eq 404) {
  Add-Result "/api" $true "404 expected"
} elseif ($apiRoot.Ok) {
  Add-Result "/api" $false "unexpected 200"
} else {
  Add-Result "/api" $false ("unexpected status " + $apiRoot.Status)
}

if ($web) {
  $webRoot = Try-GetStatus $web
  if ($webRoot.Ok -and $webRoot.Status -ge 200 -and $webRoot.Status -lt 400) {
    Add-Result "web root" $true ("status=" + $webRoot.Status)
  } else {
    Add-Result "web root" $false ("status=" + $webRoot.Status)
  }

  $corsHeaders = @{
    Origin = $web
    "Access-Control-Request-Method" = "POST"
  }
  $cors = Try-Options "$api/api/auth/login" $corsHeaders
  $allowOrigin = $null
  if ($cors.Headers) { $allowOrigin = $cors.Headers["Access-Control-Allow-Origin"] }
  if ($allowOrigin -eq $web) {
    Add-Result "cors preflight" $true "allow-origin=$allowOrigin"
  } else {
    $detail = if ($allowOrigin) { "allow-origin=$allowOrigin" } else { "missing allow-origin" }
    Add-Result "cors preflight" $false $detail
  }
}

if ($LoginEmail -and $LoginPassword) {
  try {
    $body = @{ email = $LoginEmail; password = $LoginPassword } | ConvertTo-Json -Compress
    $resp = Invoke-RestMethod -Method Post -Uri "$api/api/auth/login" -ContentType "application/json" -Body $body -TimeoutSec 20 -ErrorAction Stop
    if ($resp.token) {
      Add-Result "login" $true "token issued"
    } elseif ($resp.requiresTwoFactor -eq $true) {
      Add-Result "login" $true "2FA required"
    } else {
      Add-Result "login" $false "unexpected response"
    }
  } catch {
    Add-Result "login" $false "request failed"
  }
} else {
  Add-Result "login" $true "skipped (set -LoginEmail/-LoginPassword to test)"
}

Write-Host ""
Write-Host "Results:"
$results | Format-Table -AutoSize

$failed = @($results | Where-Object { -not $_.Ok })
if ($failed.Count -gt 0) {
  Write-Host ""
  Write-Host "Some checks failed. Review the details above."
  exit 1
}

Write-Host ""
Write-Host "All checks passed."
