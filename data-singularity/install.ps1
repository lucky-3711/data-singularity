param(
  [string]$Dest = (Join-Path $env:LOCALAPPDATA 'Programs\BlackHole'),
  [switch]$NoDesktop,
  [switch]$NoRegistry,
  [switch]$Quiet
)

$ErrorActionPreference = 'Stop'
$src = $PSScriptRoot
$appName = '黑洞'
$exeName = '黑洞.cmd'

function Say($t) { if (-not $Quiet) { Write-Host $t } }

Say ''
Say '  黑洞 · 安装'
Say '  ---------------------------------------------'

# 1) copy payload
if (Test-Path $Dest) { Remove-Item $Dest -Recurse -Force }
New-Item -ItemType Directory -Path $Dest | Out-Null

$items = @('index.html', 'app.js', 'manifest.json', 'sw.js', 'launch.ps1', '黑洞.cmd',
           'assets', 'icons', 'preview', 'README.md', '安装说明.md')
foreach ($i in $items) {
  $p = Join-Path $src $i
  if (Test-Path $p) { Copy-Item $p -Destination $Dest -Recurse -Force }
}
Say ('  已复制到 ' + $Dest)

# 2) uninstaller
Copy-Item (Join-Path $src 'uninstall.ps1') (Join-Path $Dest 'uninstall.ps1') -Force

$uninstallCmd = @"
@echo off
copy /y "%~dp0uninstall.ps1" "%TEMP%\bh_uninstall.ps1" >nul 2>nul
start "" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%TEMP%\bh_uninstall.ps1"
exit
"@
Set-Content -Path (Join-Path $Dest '卸载.cmd') -Value $uninstallCmd -Encoding Default

# 3) shortcuts
$ws = New-Object -ComObject WScript.Shell
$target = Join-Path $Dest $exeName
$icon = Join-Path $Dest 'icons\icon.ico'

function New-Lnk($path, $desc) {
  $s = $ws.CreateShortcut($path)
  $s.TargetPath = $target
  $s.WorkingDirectory = $Dest
  $s.IconLocation = $icon
  $s.Description = $desc
  $s.Save()
}

try {
  $startDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
  New-Lnk (Join-Path $startDir ($appName + '.lnk')) '黑洞 · DATA SINGULARITY'
  Say '  已创建开始菜单快捷方式'
} catch { Say '  (开始菜单快捷方式未创建，可直接用桌面图标)' }

if (-not $NoDesktop) {
  try {
    $desk = [Environment]::GetFolderPath('Desktop')
    New-Lnk (Join-Path $desk ($appName + '.lnk')) '黑洞 · DATA SINGULARITY'
    Say '  已创建桌面快捷方式'
  } catch { Say '  (桌面快捷方式未创建，可手动把文件夹里的 黑洞.lnk 拖到桌面)' }
}

# 4) add/remove entry
if (-not $NoRegistry) {
  try {
    $key = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\BlackHole'
    New-Item -Path $key -Force | Out-Null
    Set-ItemProperty $key 'DisplayName' '黑洞 · DATA SINGULARITY'
    Set-ItemProperty $key 'DisplayVersion' '1.0.0'
    Set-ItemProperty $key 'Publisher' 'DATA SINGULARITY'
    Set-ItemProperty $key 'InstallLocation' $Dest
    Set-ItemProperty $key 'DisplayIcon' $icon
    Set-ItemProperty $key 'UninstallString' ('"' + (Join-Path $Dest '卸载.cmd') + '"')
    Set-ItemProperty $key 'NoModify' 1 -Type DWord
    Set-ItemProperty $key 'NoRepair' 1 -Type DWord
    $size = 0
    Get-ChildItem $Dest -Recurse -File | ForEach-Object { $size += $_.Length }
    Set-ItemProperty $key 'EstimatedSize' ([int]($size / 1KB)) -Type DWord
    Say '  已注册到「应用和功能」'
  } catch { Say '  (未写入卸载项，可用安装目录里的 卸载.cmd)' }
}

Say '  ---------------------------------------------'
Say '  安装完成，可从开始菜单或桌面启动。'
Say ''
