# Create lib directory if it doesn't exist
if (!(Test-Path -Path "lib")) {
    New-Item -ItemType Directory -Path "lib"
}

# Download TensorFlow.js
Write-Host "Downloading TensorFlow.js..."
Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.15.0/dist/tf.min.js" -OutFile "lib/tf.min.js"

# Download Chart.js
Write-Host "Downloading Chart.js..."
Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/npm/chart.js@3.7.1/dist/chart.min.js" -OutFile "lib/chart.min.js"

Write-Host "Libraries downloaded successfully!" 