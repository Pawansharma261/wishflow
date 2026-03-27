param()
$base = 'https://wishflow-backend-uyd2.onrender.com'
$userId = 'e2e-test-final'
$phone = '919817203207'

Write-Host "=== STEP 1: Force-Reset (clears Redis session) ==="
try {
  $r1 = Invoke-RestMethod "$base/api/integrations/whatsapp/force-reset" -Method POST -ContentType 'application/json' -Body "{`"userId`":`"$userId`"}" -TimeoutSec 15
  Write-Host ($r1 | ConvertTo-Json)
  Write-Host ""
} catch { Write-Host "Reset error: $($_.Exception.Message)" }

Write-Host "=== STEP 2: Trigger pair-phone (should return immediately, code via WS) ==="
$start = Get-Date
try {
  $r2 = Invoke-RestMethod "$base/api/integrations/whatsapp/pair-phone" -Method POST -ContentType 'application/json' -Body "{`"userId`":`"$userId`",`"phoneNumber`":`"$phone`"}" -TimeoutSec 15
  $elapsed = [math]::Round(((Get-Date) - $start).TotalSeconds, 1)
  Write-Host "Response in ${elapsed}s:"
  Write-Host ($r2 | ConvertTo-Json)
  Write-Host ""
  Write-Host "Backend is running fire-and-forget pattern."
  Write-Host "The pairing code will be emitted to the browser socket within 10-30s."
  Write-Host "Browser must be connected to WebSocket and registered with userId: $userId"
} catch { 
  Write-Host "Error: $($_.Exception.Message)"
}
