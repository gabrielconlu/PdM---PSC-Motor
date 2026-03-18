// --- CONFIGURATION ---
// Siguraduhin na ito ang Web App URL mula sa Google Apps Script "Deploy"
const url = "https://script.google.com/macros/s/AKfycbxVt2OEhv_YPjhrjvrw7uM0jvkvPeJAOlzwOfVXDiR2030heB3LPt9e9aLYxbnmJK0n/exec"; 

// Dashboard State
let motorRunning = false;
let logHistory = [];

// --- CHART INITIALIZATION ---
const ctx = document.getElementById('myChart').getContext('2d');
let myChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Motor Temp (°C)',
            data: [],
            borderColor: '#ff4444',
            backgroundColor: 'rgba(255, 68, 68, 0.1)',
            borderWidth: 3,
            pointRadius: 2,
            tension: 0.3,
            fill: true
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: { 
                beginAtZero: false,
                min: 20, 
                max: 60, // Adjust base sa init ng motor mo
                title: { display: true, text: 'Temperature °C', color: '#ff4444' },
                grid: { color: '#222' }
            },
            x: { grid: { display: false }, ticks: { color: '#888' } }
        },
        plugins: {
            legend: { labels: { color: '#e0e6ed' } }
        }
    }
});

// --- WEB SERIAL CONNECTION ---
async function connectSerial() {
    try {
        const port = await navigator.serial.requestPort();
        await port.open({ baudRate: 115200 });
        
        logEvent("CONNECTED: ESP32 Temperature Monitor Active.");
        
        const textDecoder = new TextDecoderStream();
        port.readable.pipeTo(textDecoder.writable);
        const reader = textDecoder.readable.getReader();

        // Basahin ang stream nang tuloy-tuloy
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value && value.includes("DATA:")) {
                processSerialData(value);
            }
        }
    } catch (e) {
        logEvent("ERROR: " + e.message);
        console.error("Serial Connection Failed:", e);
    }
}

// --- DATA PROCESSING ---
function processSerialData(rawLine) {
    // Ang format mula sa ESP32: "DATA:25.50,0,0"
    const dataPart = rawLine.split("DATA:")[1];
    if (!dataPart) return;

    const values = dataPart.split(",");
    const temp = parseFloat(values[0]);

    if (isNaN(temp)) return;

    // 1. Update Real-time Display
    document.getElementById('temp-display').innerText = temp.toFixed(1) + "°C";

    // 2. Update Status Light (Simple Logic)
    updateStatusLight(temp);

    // 3. Update Chart
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    myChart.data.labels.push(now);
    myChart.data.datasets[0].data.push(temp);

    // I-limit lang sa huling 30 readings para hindi bumagal ang browser
    if (myChart.data.labels.length > 30) {
        myChart.data.labels.shift();
        myChart.data.datasets[0].data.shift();
    }
    myChart.update('none');

    // 4. Sync to Google Sheets
    syncToSheets(temp);
}

// --- GOOGLE SHEETS SYNC ---
async function syncToSheets(t) {
    try {
        // Ipinapadala natin as JSON sa iyong Google Script
        fetch(url, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                temp: t,
                amps: 0, // Placeholder muna
                vib: 0,  // Placeholder muna
                timestamp: new Date().toLocaleString()
            })
        });
    } catch (e) {
        console.warn("Sheets sync failed.");
    }
}

// --- UI HELPERS ---
function updateStatusLight(t) {
    const light = document.getElementById('temp-light');
    if (!light) return;

    if (t > 50) {
        light.className = "status-light critical";
        if (!motorRunning) logEvent("ADVISORY: High temperature detected!");
    } else if (t > 40) {
        light.className = "status-light warning";
    } else {
        light.className = "status-light normal";
    }
}

function logEvent(msg) {
    const list = document.getElementById('event-list');
    if (!list) return;

    const entry = document.createElement('li');
    entry.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
    list.prepend(entry);

    // Save to LocalStorage para hindi mawala ang logs pag ni-refresh
    let logs = JSON.parse(localStorage.getItem('motorLogs')) || [];
    logs.unshift(entry.innerText);
    if (logs.length > 50) logs.pop();
    localStorage.setItem('motorLogs', JSON.stringify(logs));
}

function clearHistory() {
    if (confirm("Delete all logs?")) {
        localStorage.removeItem('motorLogs');
        document.getElementById('event-list').innerHTML = "";
    }
}

// Restore logs on load
window.onload = function() {
    const list = document.getElementById('event-list');
    const savedLogs = JSON.parse(localStorage.getItem('motorLogs')) || [];
    savedLogs.forEach(log => {
        const entry = document.createElement('li');
        entry.innerText = log;
        list.appendChild(entry);
    });
};
