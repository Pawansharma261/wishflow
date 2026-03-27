param()
$base = 'https://wishflow-backend-uyd2.onrender.com'
$phone = '919817203207'
# Use a unique userId tied to this test session
$userId = "diagtest-$(Get-Date -Format 'HHmmss')"

Write-Host "=== DIAGNOSTIC TEST ===" 
Write-Host "userId=$userId phone=$phone"
Write-Host ""

# Step 1: force-reset with scan
Write-Host "[1] Force-reset..."
$r1 = Invoke-RestMethod "$base/api/integrations/whatsapp/force-reset" -Method POST -ContentType 'application/json' -Body "{`"userId`":`"$userId`"}" -TimeoutSec 20
Write-Host "    keysDeleted=$($r1.keysDeleted)"

Start-Sleep -Seconds 2

# Step 2: Trigger pair-phone
Write-Host "[2] Triggering pair-phone..."
$r2 = Invoke-RestMethod "$base/api/integrations/whatsapp/pair-phone" -Method POST -ContentType 'application/json' -Body "{`"userId`":`"$userId`",`"phoneNumber`":`"$phone`"}" -TimeoutSec 15
Write-Host "    $($r2.message)"

Write-Host ""
Write-Host "[3] Waiting 90s for socket state to settle. Monitor the code below..."
Write-Host "    (In a real browser, the WebSocket room '$userId' receives 'whatsapp_pairing_code' event)"
Write-Host ""

# Poll a diagnostic endpoint we'll add
for ($i = 1; $i -le 9; $i++) {
    Start-Sleep -Seconds 10
    Write-Host "[$($i*10)s] Checking socket status for $userId..."
    try {
        $status = Invoke-RestMethod "$base/api/integrations/whatsapp/status/$userId" -Method GET -TimeoutSec 10
        Write-Host "     status=$($status.status) socketAlive=$($status.socketAlive)"
    } catch {
        Write-Host "     status endpoint error: $($_.Exception.Message)"
    }
}
