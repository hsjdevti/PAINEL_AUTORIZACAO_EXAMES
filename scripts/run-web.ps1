$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $ProjectRoot "logs"
$BundledNode = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$NodeCommand = Get-Command node -ErrorAction SilentlyContinue

if ($NodeCommand) {
  $Node = $NodeCommand.Source
} elseif (Test-Path -LiteralPath $BundledNode) {
  $Node = $BundledNode
} else {
  throw "Node.js não encontrado no PATH e runtime embutido do Codex não está disponível."
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
Set-Location $ProjectRoot

$ErrorActionPreference = "Continue"
Start-Transcript -Path (Join-Path $LogDir "web.live.log") -Force | Out-Null
try {
  & $Node node_modules\vite\bin\vite.js dev --host 0.0.0.0
} finally {
  Stop-Transcript | Out-Null
}
