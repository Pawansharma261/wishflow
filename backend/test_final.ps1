param()
$base = 'https://wishflow-backend-uyd2.onrender.com'
$phone = '919817203207'
$userId = 'live-final-test'

Write-Host "=== STEP 1: Deep Redis SCAN reset ==="
$r1 = Invoke-RestMethod "$base/api/integrations/whatsapp/force-reset" -Method POST -ContentType 'application/json' -Body "{`"userId`":`"$userId`"}" -TimeoutSec 20
Write-Host "Keys deleted: $($r1.keysDeleted) | $($r1.message)"

Write-Host ""
Write-Host "=== STEP 2: Trigger pairing ==="
$r2 = Invoke-RestMethod "$base/api/integrations/whatsapp/pair-phone" -Method POST -ContentType 'application/json' -Body "{`"userId`":`"$userId`",`"phoneNumber`":`"$phone`"}" -TimeoutSec 15
Write-Host $r2.message

Write-Host ""
Write-Host "Pairing running in background on server. Code will arrive via WebSocket."
Write-Host "Since we don't have a socket here, check the backend logs for the generated code."
Write-Host ""
Write-Host "Waiting 30s for pairing to complete on server..."
Start-Sleep -Seconds 30
Write-Host "Done. If no error in backend logs, the pairing code was generated successfully."
