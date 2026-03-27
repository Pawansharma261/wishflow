param()
$url = 'https://wishflow-backend-uyd2.onrender.com/api/integrations/whatsapp/pair-phone'
$body = '{"userId":"poll-live","phoneNumber":"919817203207"}'

for ($i = 1; $i -le 12; $i++) {
    Write-Host "=== Poll $i at $(Get-Date -Format 'HH:mm:ss') ==="
    try {
        $r = Invoke-RestMethod -Uri $url -Method POST -ContentType 'application/json' -Body $body -TimeoutSec 80
        $json = $r | ConvertTo-Json -Depth 3
        Write-Host $json
        if ($r.pairingCode) {
            Write-Host "`n SUCCESS! Pairing code: $($r.pairingCode)"
            exit 0
        } elseif ($r.error) {
            Write-Host "Backend error (new code live): $($r.error)"
            exit 0
        } else {
            Write-Host "Old code still running. Waiting 30s...`n"
            Start-Sleep -Seconds 30
        }
    } catch {
        Write-Host "Fetch error (server restarting?): $($_.Exception.Message)"
        Start-Sleep -Seconds 20
    }
}
Write-Host "Polling complete."
