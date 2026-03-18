// --- CONFIGURATION ---
const url = "https://script.google.com/macros/s/AKfycbwSOu_RIydveUUzbOvDLDuId2BG14_qzjqTXPnK7gSKmYsdSYkJulYUza0aMWmjA1M/exec"; 

let myChart;
let motorRunning = false;

// --- INITIALIZE DASHBOARD ---
window.onload = function() {
    const ctx = document.getElementById('myChart').getContext('2d');
    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: 'Temp (°C)', data: [], borderColor: '#ff4444', borderWidth: 3, pointRadius: 0, tension: 0.3, yAxisID: 'y' },
                { label: 'Current (A)', data: [], borderColor: '#00ccff', borderWidth: 2, pointRadius: 0, tension: 0.3, yAxisID: 'y1' },
                { label: 'Vibration (G)', data: [], borderColor: '#00ff88', borderWidth: 2, pointRadius: 0, tension: 0.3, yAxisID: 'y1' }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { type: 'linear', position: 'left', min: 20, max: 80, title: { display: true, text: 'Temp °C' } },
                y1: { type: 'linear', position: 'right', min: 0, max: 10, grid: { display: false } }
            }
        }
    });

    // Restore logs from local storage
    const list = document.getElementById('event-list');
    const savedLogs = JSON.parse(localStorage.getItem('motorLogs')) || [];
    savedLogs.forEach(log => {
        const entry = document.createElement('li');
        entry.innerText = log;
        list.appendChild(entry);
    });
};

// --- WEB SERIAL CONNECTION ---
async function connectSerial() {
    try {
        const port = await navigator.serial.requestPort();
        await port.open({ baudRate: 115200 });
        logEvent("CONNECTED: Serial communication started.");
        
        const textDecoder = new TextDecoderStream();
        port.readable.pipeTo(textDecoder.writable);
        const reader = textDecoder.readable.getReader();

        let buffer = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            
            buffer += value;
            let lines = buffer.split("\n");
            buffer = lines.pop(); 

            for (let line of lines) {
                if (line.trim().includes("DATA:")) {
                    processSerialData(line.trim());
                }
            }
        }
    } catch (e) { 
        logEvent("ERROR: " + e.message); 
        console.error("Serial error:", e);
    }
}

// --- DATA PROCESSING & SYNC ---
function processSerialData(rawLine) {
    const dataPart = rawLine.split("DATA:")[1];
    if (!dataPart) return;

    const parts = dataPart.split(",");
    const t = parseFloat(parts[0]) || 0;
    const c = parseFloat(parts[1]) || 0;
    const v = parseFloat(parts[2]) || 0;

    // 1. Update Display Cards
    document.getElementById('temp-display').innerText = t.toFixed(1) + "°C";
    document.getElementById('curr-display').innerText = c.toFixed(2) + "A";
    document.getElementById('vib-display').innerText = v.toFixed(2) + "G";

    // 2. Update Chart
    const now = new Date().toLocaleTimeString([], { hour12: false });
    myChart.data.labels.push(now);
    myChart.data.datasets[0].data.push(t);
    myChart.data.datasets[1].data.push(c);
    myChart.data.datasets[2].data.push(v);

    if (myChart.data.labels.length > 20) {
        myChart.data.labels.shift();
        myChart.data.datasets.forEach(ds => ds.data.shift());
    }
    myChart.update('none');

    // 3. Update Status Lights
    updateStatusLights(t);

    // 4. SYNC TO GOOGLE SHEETS
    syncToSheets(t, c, v);
}

async function syncToSheets(t, c, v) {
    try {
        fetch(url, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ temp: t, amps: c, vib: v })
        });
    } catch (e) { 
        console.warn("Sheets Sync Failed."); 
    }
}

// --- HELPERS ---
function updateStatusLights(t) {
    const tLight = document.getElementById('temp-light');
    if(tLight) {
        tLight.className = "status-light " + (t > 55 ? 'critical' : t > 45 ? 'warning' : 'normal');
    }
}

function logEvent(msg) {
    const list = document.getElementById('event-list');
    if (!list) return;
    const fullMsg = `[${new Date().toLocaleTimeString()}] ${msg}`;
    const entry = document.createElement('li');
    entry.innerText = fullMsg;
    list.prepend(entry);
    
    let logs = JSON.parse(localStorage.getItem('motorLogs')) || [];
    logs.unshift(fullMsg);
    if (logs.length > 50) logs.pop();
    localStorage.setItem('motorLogs', JSON.stringify(logs));
}

function clearHistory() {
    if (confirm("Clear all logs?")) {
        localStorage.removeItem('motorLogs');
        location.reload();
    }
}
