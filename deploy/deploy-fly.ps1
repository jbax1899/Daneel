$ErrorActionPreference = 'Stop'

if (-not (Get-Command fly -ErrorAction SilentlyContinue)) {
  Write-Host "Fly CLI is required. Install from https://fly.io/docs/flyctl/install/"
  exit 1
}

function Get-FlyAppName {
  param([string]$ConfigPath)
  $content = Get-Content $ConfigPath -Raw
  if ($content -match '(?m)^\s*app\s*=\s*["'']([^"'' ]+)["'']') {
    return $Matches[1]
  }
  throw "Unable to find app name in $ConfigPath"
}

function Ensure-FlyApp {
  param([string]$ConfigPath)
  $appName = Get-FlyAppName -ConfigPath $ConfigPath
  $output = & fly apps create $appName 2>&1
  if ($LASTEXITCODE -ne 0) {
    if ($output -match 'already exists|already taken|Name has already been taken') {
      Write-Host "Fly app already exists: $appName"
      return
    }
    Write-Host $output
    throw "Failed to create Fly app: $appName"
  }
  Write-Host "Created Fly app: $appName"
}

function Get-FlySecretNames {
  param([string]$AppName)
  $output = & fly secrets list -a $AppName 2>$null
  if ($LASTEXITCODE -ne 0) {
    return @()
  }
  $lines = $output -split "`r?`n" | Where-Object { $_ -and $_ -notmatch '^\s*NAME' }
  return $lines | ForEach-Object { ($_ -split '\s+')[0] }
}

function Get-EnvValueFromFile {
  param(
    [string]$EnvPath,
    [string]$Key
  )
  if (-not (Test-Path $EnvPath)) {
    return $null
  }
  $lines = Get-Content $EnvPath
  foreach ($line in $lines) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) {
      continue
    }
    $parts = $trimmed -split '=', 2
    if ($parts.Count -lt 2) {
      continue
    }
    if ($parts[0].Trim() -eq $Key) {
      return $parts[1].Trim()
    }
  }
  return $null
}

function Ensure-FlySecrets {
  param(
    [string]$AppName,
    [string[]]$RequiredSecrets,
    [string[]]$OptionalSecrets,
    [string]$EnvPath
  )
  Write-Host "Checking secrets for $AppName..."
  $existing = Get-FlySecretNames -AppName $AppName
  foreach ($secret in $RequiredSecrets) {
    if ($existing -notcontains $secret) {
      Write-Host "Setting required secret $secret for $AppName..."
      $value = Get-EnvValueFromFile -EnvPath $EnvPath -Key $secret
      if ($value) {
        Write-Host "Using $secret from $EnvPath."
      } else {
        $value = Read-Host "Enter value for $secret (required for $AppName)"
      }
      if ($value -and $value.Trim().Length -gt 0) {
        & fly secrets set "$secret=$value" -a $AppName | Out-Null
        Write-Host "Set $secret for $AppName."
      } else {
        throw "Missing required secret $secret for $AppName"
      }
    }
  }

  foreach ($secret in $OptionalSecrets) {
    if ($existing -notcontains $secret) {
      Write-Host "Setting optional secret $secret for $AppName..."
      $value = Get-EnvValueFromFile -EnvPath $EnvPath -Key $secret
      if ($value) {
        Write-Host "Using $secret from $EnvPath."
      } else {
        $value = Read-Host "Enter value for $secret (optional for $AppName, leave blank to skip)"
      }
      if ($value -and $value.Trim().Length -gt 0) {
        & fly secrets set "$secret=$value" -a $AppName | Out-Null
        Write-Host "Set $secret for $AppName."
      } else {
        Write-Host "Skipped $secret for $AppName."
      }
    }
  }
}

$configRoot = $PSScriptRoot
$envPath = Join-Path $configRoot '..\.env'

Write-Host "Ensuring Fly apps exist..."
Ensure-FlyApp -ConfigPath (Join-Path $configRoot 'fly.backend.toml')
Ensure-FlyApp -ConfigPath (Join-Path $configRoot 'fly.web.toml')
Ensure-FlyApp -ConfigPath (Join-Path $configRoot 'fly.bot.toml')

$botAppName = Get-FlyAppName -ConfigPath (Join-Path $configRoot 'fly.bot.toml')
$backendAppName = Get-FlyAppName -ConfigPath (Join-Path $configRoot 'fly.backend.toml')
$webAppName = Get-FlyAppName -ConfigPath (Join-Path $configRoot 'fly.web.toml')

Write-Host "Configuring backend secrets..."
Ensure-FlySecrets -AppName $backendAppName `
  -RequiredSecrets @('OPENAI_API_KEY') `
  -OptionalSecrets @('TURNSTILE_SECRET_KEY', 'TURNSTILE_SITE_KEY', 'GITHUB_WEBHOOK_SECRET') `
  -EnvPath $envPath

Write-Host "Configuring bot secrets..."
Ensure-FlySecrets -AppName $botAppName `
  -RequiredSecrets @('DISCORD_TOKEN', 'CLIENT_ID', 'GUILD_ID', 'OPENAI_API_KEY', 'DEVELOPER_USER_ID', 'INCIDENT_PSEUDONYMIZATION_SECRET') `
  -OptionalSecrets @() `
  -EnvPath $envPath

Write-Host "Deploying backend..."
fly deploy -c (Join-Path $configRoot 'fly.backend.toml')
Write-Host "Scaling backend to one instance..."
fly scale count 1 -a $backendAppName -y
Write-Host "Deploying web..."
fly deploy -c (Join-Path $configRoot 'fly.web.toml')
Write-Host "Scaling web to one instance..."
fly scale count 1 -a $webAppName -y
Write-Host "Deploying bot..."
fly deploy -c (Join-Path $configRoot 'fly.bot.toml')

Write-Host "Scaling bot to one instance..."
fly scale count 1 -a $botAppName -y

$startScript = Join-Path $configRoot 'fly-start.ps1'
if (Test-Path $startScript) {
  Write-Host "Starting all apps..."
  & $startScript
}
