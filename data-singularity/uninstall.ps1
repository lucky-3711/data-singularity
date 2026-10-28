$ErrorActionPreference = 'SilentlyContinue'
$appName = '黑洞'
$dest = Join-Path $env:LOCALAPPDATA 'Programs\BlackHole'

$startDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
Remove-Item (Join-Path $startDir ($appName + '.lnk')) -Force

$desk = [Environment]::GetFolderPath('Desktop')
Remove-Item (Join-Path $desk ($appName + '.lnk')) -Force

Remove-Item 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\BlackHole' -Recurse -Force

Start-Sleep -Milliseconds 400
if (Test-Path $dest) {
  Remove-Item $dest -Recurse -Force
}

Add-Type -AssemblyName PresentationFramework
[System.Windows.MessageBox]::Show('黑洞 已卸载。', '黑洞', 'OK', 'Information') | Out-Null
