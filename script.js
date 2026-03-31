const url = "https://script.google.com/macros/s/AKfycbwSOu_RIydveUUzbOvDLDuId2BG14_qzjqTXPnK7gSKmYsdSYkJulYUza0aMWmjA1M/exec"; 

let myChart;
let port, reader, keepReading = true;
let isCalibrating = false;
let calibCount = 0;
const CALIB_LIMIT = 30; // 30 samples para sa baseline

window.onload = function() {
    const ctx = document.getElementById('myChart').getContext('2d');
    myChart = new Chart(ctx, {
        type: 'line', // Pwede ring 'scatter' kung prefer mo
        data: {
            labels: [],
            datasets: [
                { label: 'Temp (°C)', data: [], borderColor: '#ef4444', borderWidth: 2, pointRadius: 2, tension: 0.3, yAxisID: 'y' },
                { label: 'Vibration (G)', data: [], borderColor: '#22c55e', borderWidth: 2, pointRadius: 2, tension: 0.3, yAxisID: 'y1' }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { type: 'linear', display: true, position: 'left', ticks: { color: '#ef4444' } },
                y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, ticks: { color: '#22c55e' } }
            }
        }
    });
};

async function connectSerial() {
    try {
        port = await navigator.serial.requestPort();
        await port.open({ baudRate: 115200 });
        
        keepReading = true;
        isCalibrating = true;
        calibCount = 0;
        
        document.getElementById('connect-btn').style.display = "none";
        document.getElementById('disconnect-btn').style.display = "inline-block";
        document.getElementById('calib-container').style.display = "block";
        document.getElementById('ai-suggestion').innerText = "CALIBRATING...";
        
        logEvent("CONNECTED: Starting Baseline Calibration.");

        const textDecoder = new TextDecoderStream();
        port.readable.pipeTo(textDecoder.writable);
        reader = textDecoder.readable.getReader();

        let buffer = "";
        while (keepReading) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += value;
            let lines = buffer.split("\n");
            buffer = lines.pop(); 
            for (let line of lines) {
                if (line.includes("DATA:")) processData(line.trim());
            }
        }
    } catch (e) { logEvent("ERROR: " + e.message); }
}

function processData(rawLine) {
    const dataPart = rawLine.split("DATA:")[1];
    if (!dataPart) return;

    const [t, v] = dataPart.split(",").map(parseFloat);
    if (isNaN(t) || isNaN(v)) return;

    // UI Updates
    document.getElementById('temp-display').innerText = t.toFixed(1) + "°C";
    document.getElementById('vib-display').innerText = v.toFixed(2) + "G";

    // Calibration Logic
    if (isCalibrating) {
        calibCount++;
        let progress = (calibCount / CALIB_LIMIT) * 100;
        document.getElementById('calib-progress-bar').style.width = progress + "%";
        
        if (calibCount >= CALIB_LIMIT) {
            isCalibrating = false;
            document.getElementById('calib-container').style.display = "none";
            document.getElementById('ai-suggestion').innerText = "MONITORING ACTIVE";
            document.getElementById('ai-action-step').innerText = "Streaming baseline-adjusted data to Sheets...";
            logEvent("CALIBRATION COMPLETE: Baseline Established.");
        }
        return; // Wag muna mag-log/chart habang nag-ca-calibrate
    }

    // Status Updates
    updateStatus('temp-light', t, 60, 75);
    updateStatus('vib-light', v, 0.5, 1.0);

    // Chart Update
    const now = new Date().toLocaleTimeString([], { hour12: false });
    myChart.data.labels.push(now);
    myChart.data.datasets[0].data.push(t);
    myChart.data.datasets[1].data.push(v);
    if (myChart.data.labels.length > 30) {
        myChart.data.labels.shift();
        myChart.data.datasets.forEach(d => d.data.shift());
    }
    myChart.update('none');

    // Cloud Sync
    syncToSheets(t, v);
}

async function syncToSheets(t, v) {
    try {
        fetch(`${url}?temp=${t}&vibration=${v}`, { method: 'GET', mode: 'no-cors' });
        document.getElementById('sync-status').innerText = "Synced";
        document.getElementById('sync-status').style.color = "#00ff88";
    } catch (e) { document.getElementById('sync-status').innerText = "Error"; }
}

// ... (Kopyahin ang dating disconnectSerial, logEvent, clearHistory functions)
