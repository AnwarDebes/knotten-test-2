$log = "C:\Users\anwar\Downloads\knotten\renders\relayout.log"
while (-not (Select-String -Path $log -Pattern "ANIM DONE|ALL DONE" -Quiet)) { Start-Sleep -Seconds 60 }
Set-Location "C:\Users\anwar\Downloads\knotten"
python pipeline\optimise_images.py | Out-File -Append -Encoding utf8 renders\relayout.log
if (Test-Path renders\knotten_flyin_720p.mp4) { Copy-Item renders\knotten_flyin_720p.mp4 site\public\renders\knotten_flyin_720p.mp4 -Force; "copied mp4" | Out-File -Append -Encoding utf8 renders\relayout.log }
