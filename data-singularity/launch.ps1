$ErrorActionPreference = 'SilentlyContinue'

$pf86 = ${env:ProgramFiles(x86)}
$pf = $env:ProgramFiles
$lad = $env:LocalAppData

$candidates = @(
  (Join-Path $pf86 'Microsoft\Edge\Application\msedge.exe'),
  (Join-Path $pf   'Microsoft\Edge\Application\msedge.exe'),
  (Join-Path $lad  'Microsoft\Edge\Application\msedge.exe'),
  (Join-Path $pf   'Google\Chrome\Application\chrome.exe'),
  (Join-Path $pf86 'Google\Chrome\Application\chrome.exe'),
  (Join-Path $lad  'Google\Chrome\Application\chrome.exe')
)

$edge = $null
foreach ($c in $candidates) {
  if ($c -and (Test-Path $c)) { $edge = $c; break }
}

$page = Join-Path $PSScriptRoot 'index.html'
$uri = ([Uri]$page).AbsoluteUri
$profileDir = Join-Path $lad 'BlackHoleApp'

if ($edge) {
  Start-Process -FilePath $edge -ArgumentList @(
    "--app=$uri",
    '--window-size=1440,920',
    "--user-data-dir=$profileDir",
    '--no-first-run',
    '--no-default-browser-check'
  )
} else {
  Start-Process $uri
}
