param()
$url = 'https://wishflow-backend-uyd2.onrender.com/api/integrations/whatsapp/pair-phone'
$body = '{"userId":"ws-validate-001","phoneNumber":"919817203207"}'

Write-Host "=== Testing fire-and-forget pattern on LIVE server ==="
Write-Host "Calling at $(Get-Date -Format 'HH:mm:ss')..."
$start = Get-Date
try {
  $r = Invoke-RestMethod -Uri $url -Method POST -ContentType 'application/json' -Body $body -TimeoutSec 15
  $elapsed = [math]::Round(((Get-Date) - $start).TotalSeconds, 1)
  $json = $r | ConvertTo-Json -Depth 3
  Write-Host "Response in ${elapsed}s: $json"
  
  if ($elapsed -lt 5) {
    Write-Host ""
    Write-Host "SUCCESS: Server responded in ${elapsed}s (fast = new fire-and-forget code is live!)"
    Write-Host "The pairing code will be pushed to the browser via WebSocket 'whatsapp_pairing_code' event"
  } else {
    Write-Host ""
    Write-Host "WARNING: Server took ${elapsed}s - may still be running old code"
  }
} catch {
  $elapsed = [math]::Round(((Get-Date) - $start).TotalSeconds, 1)
  Write-Host "Error after ${elapsed}s: $($_.Exception.Message)"
  try {
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    Write-Host "Body: $($reader.ReadToEnd())"
  } catch {}
}
