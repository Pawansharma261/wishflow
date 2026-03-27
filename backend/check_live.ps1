param()
Write-Host "=== Checking what code is live on Render ==="
$base = 'https://wishflow-backend-uyd2.onrender.com'

# Check health/version
try { 
  $h = Invoke-RestMethod "$base/" -TimeoutSec 10 -ErrorAction SilentlyContinue
  Write-Host "Root: $($h | ConvertTo-Json)"
} catch { Write-Host "Root error: $($_.Exception.Message)" }

# Test force-reset to see what the response format is (tells us code version)
Write-Host ""
Write-Host "=== Testing force-reset ==="
try {
  $r = Invoke-RestMethod "$base/api/integrations/whatsapp/force-reset" -Method POST -ContentType 'application/json' -Body '{"userId":"version-check"}' -TimeoutSec 10
  Write-Host ($r | ConvertTo-Json)
} catch { Write-Host "Error: $($_.Exception.Message)" }

# Test pair-phone with wrong data to see error format  
Write-Host ""
Write-Host "=== Testing pair-phone (no body - should show 400 error format) ==="
try {
  $r = Invoke-RestMethod "$base/api/integrations/whatsapp/pair-phone" -Method POST -ContentType 'application/json' -Body '{}' -TimeoutSec 10
  Write-Host ($r | ConvertTo-Json)
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  $stream = $_.Exception.Response.GetResponseStream()
  $reader = New-Object System.IO.StreamReader($stream)
  $body = $reader.ReadToEnd()
  Write-Host "HTTP $code`: $body"
}
