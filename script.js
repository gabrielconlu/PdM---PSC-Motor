// --- CONFIGURATION ---
const url = "https://script.google.com/macros/s/AKfycbzq4DXz6astSv4nKQdvjH7VfsVT9y6qXnb52142_ZaNCIViVi5KjARpV-zWVFdQmwO-/exec"; 

let motorRunning = false;
let myChart;

// --- INITIALIZE UI & CHART ---
window.onload = function() {
    const ctx = document.getElementById('myChart').getContext('2d');
    myChart = new Chart(ctx, {
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
                y: { min: 20, max: 70, title: { display: true, text: 'Temperature °C', color: '#ff4444' } },
                x: { ticks: { color: '#888' }, grid: { display: false } }
            }
        }
    });

    // Restore logs
    const list = document.getElementById('event-list');
    const savedLogs = JSON.parse(localStorage.getItem('motorLogs')) || [];
    savedLogs.forEach(log => {
        const entry = document.createElement('li');
        entry.innerText = log;
        list.appendChild(entry);
    });
};

// --- WEB SERIAL WITH LINE BUFFERING ---
async function connectSerial() {
    try {
        const port = await navigator.serial.requestPort();
        await port.open({ baudRate: 115200 });
        logEvent("CONNECTED: Serial stream active.");

        const textDecoder = new TextDecoderStream();
        port.readable.pipeTo(textDecoder.writable);
        const reader = textDecoder.readable.getReader();

        let buffer = ""; // Buffer para sa napuputol na stream chunks

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            
            buffer += value;
            let lines = buffer.split("\n");
            buffer = lines.pop(); // Itago ang huling incomplete line sa buffer

            for (let line of lines) {
                if (line.trim().includes("DATA:")) {
                    processSerialData(line.trim());
                }
            }
        }
    } catch (e) {
        logEvent("CONNECTION ERROR: " + e.message);
    }
}

// --- DATA PROCESSING ---
function processSerialData(rawLine) {
    try {
        const dataPart = rawLine.split("DATA:")[1];
        if (!dataPart) return;

        const values = dataPart.split(",");
        const temp = parseFloat(values[0]);

        if (isNaN(temp)) return;

        // 1. Update Display Cards
        document.getElementById('temp-display').innerText = temp.toFixed(1) + "°C";
        
        // 2. Simple Logic for status lights
        updateStatusLight(temp);

        // 3. Update Chart
        const now = new Date().toLocaleTimeString([], { hour12: false });
        myChart.data.labels.push(now);
        myChart.data.datasets[0].data.push(temp);

        if (myChart.data.labels.length > 30) {
            myChart.data.labels.shift();
            myChart.data.datasets[0].data.shift();
        }
        myChart.update('none');

        // 4. Send to Google Sheets
        syncToSheets(temp);
    } catch (err) {
        console.error("Parsing Error:", err);
    }
}

// --- RELIABLE GOOGLE SYNC ---
async function syncToSheets(t) {
    // Gumamit ng URLSearchParams para sa mas stable na POST sa Apps Script
    try {
        const payload = {
            temp: t,
            amps: 0,
            vib: 0
        };

        fetch(url, {
            method: 'POST',
            mode: 'no-cors', // Mahalaga para sa Apps Script redirects
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (e) {
        console.warn("Sheets sync offline.");
    }
}

// --- UI HELPERS ---
function updateStatusLight(t) {
    const light = document.getElementById('temp-light');
    if (!light) return;

    if (t > 55) {
        light.className = "status-light critical";
        logEvent("ALERT: Temperature critical at " + t.toFixed(1) + "°C");
    } else if (t > 45) {
        light.className = "status-light warning";
    } else {
        light.className = "status-light normal";
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
        document.getElementById('event-list').innerHTML = "";
    }
}
