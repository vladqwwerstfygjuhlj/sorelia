Set-Location $PSScriptRoot
Get-Content ".env" | ForEach-Object {
  if ($_ -match "^\s*$") { return }
  if ($_ -match "^\s*#") { return }
  $parts = $_ -split "=", 2
  if ($parts.Length -ne 2) { return }
  $name = $parts[0].Trim()
  $value = $parts[1].Trim()
  [Environment]::SetEnvironmentVariable($name, $value, "Process")
}

python bot.py
