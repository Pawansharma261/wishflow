param()
$base = 'https://wishflow-backend-uyd2.onrender.com'
$userId = 'validate-scan-reset'

Write-Host "=== Testing deep force-reset with Redis SCAN ===" 
try {
  $r = Invoke-RestMethod "$base/api/integrations/whatsapp/force-reset" -Method POST -ContentType 'application/json' -Body "{`"userId`":`"$userId`"}" -TimeoutSec 20
  Write-Host ($r | ConvertTo-Json)
  if ($r.keysDeleted -ne $null) {
    Write-Host ""
    Write-Host "SUCCESS: New SCAN-based force-reset is live!"
    Write-Host "Keys deleted: $($r.keysDeleted)"
  } else {
    Write-Host "Old force-reset still running (no keysDeleted field)"
  }
} catch { Write-Host "Error: $($_.Exception.Message)" }
