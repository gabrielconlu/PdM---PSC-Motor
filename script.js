// Gamitin ang iyong bagong Deployment ID
const url = "https://script.google.com/macros/s/AKfycbwpDizpqZzclgyQzu02s_yLXQM6fJDTHQG6w_g-AN8BNhIDbOQ8uE6mGk8POqWf19ul/exec"; 

let myChart;
let fetchInterval;

window.onload = function() {
    initChart(); 
};

// --- CHART INITIALIZATION ---
function initChart() {
    const ctx = document.getElementById('myChart').getContext('2d');
    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: 'Temp (°C)', data: [], borderColor: '#ef4444', borderWidth: 2, pointRadius: 2, tension: 0.3, yAxisID: 'y' },
                { label: 'Vibration (G)', data: [], borderColor: '#22c55e', borderWidth: 2, pointRadius: 2, tension: 0.3, yAxisID: 'y1' }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { type: 'linear', display: true, position: 'left', ticks: { color: '#ef4444' } },
                y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, ticks: { color: '#22c55e' } }
            }
        }
    });
}

// --- CLOUD SYNC LOGIC ---
async function startMonitoring() {
    document.getElementById('connect-btn').style.display = "none";
    document.getElementById('disconnect-btn').style.display = "inline-block";
    
    logEvent("SYSTEM START: Fetching data from Google Sheets...");
    
    // Unang kuha agad ng data
    fetchDataFromSheets();
    
    // Polling every 5 seconds
    fetchInterval = setInterval(fetchDataFromSheets, 5000);
}

async function fetchDataFromSheets() {
    try {
        const syncLabel = document.getElementById('sync-status');
        syncLabel.innerText = "Fetching...";
        syncLabel.style.color = "#8892b0";

        // Request with cache-buster para laging fresh data
        const response = await fetch(`${url}?read=true&t=${new Date().getTime()}`);
        const data = await response.json();

        if (data.temp !== undefined) {
            updateDashboard(data.temp, data.vibration, data.status);
            syncLabel.innerText = "Live";
            syncLabel.style.color = "#00ff88";
        }
    } catch (e) {
        console.error("Fetch Error:", e);
        const syncLabel = document.getElementById('sync-status');
        syncLabel.innerText = "Offline";
        syncLabel.style.color = "#ef4444";
    }
}

function updateDashboard(t, v, s) {
    const tempVal = parseFloat(t);
    const vibVal = parseFloat(v);

    // Update numerical displays
    document.getElementById('temp-display').innerText = tempVal.toFixed(1) + "°C";
    document.getElementById('vib-display').innerText = vibVal.toFixed(2) + "G";

    // AI Status & Threshold Logic
    const aiSug = document.getElementById('ai-suggestion');
    const aiAction = document.getElementById('ai-action-step');
    const health = document.getElementById('motor-health-score');

    if (tempVal >= 70 || vibVal >= 3.0) {
        aiSug.innerText = "CRITICAL: " + s.toUpperCase();
        aiSug.style.color = "#ef4444";
        aiAction.innerHTML = "⚠️ <b>HUMAN CHECK REQUIRED:</b> Burning smell or humming detected!";
        health.innerText = "40%";
        health.style.color = "#ef4444";
        updateStatusLight('temp-light', '#ef4444');
        updateStatusLight('vib-light', '#ef4444');
    } else {
        aiSug.innerText = "SYSTEM NORMAL";
        aiSug.style.color = "#00ff88";
        aiAction.innerText = "Monitoring PSC Motor health in real-time...";
        health.innerText = "100%";
        health.style.color = "#00ff88";
        updateStatusLight('temp-light', '#00ff88');
        updateStatusLight('vib-light', '#00ff88');
    }

    // Chart Update
    const now = new Date().toLocaleTimeString([], { hour12: false });
    myChart.data.labels.push(now);
    myChart.data.datasets[0].data.push(tempVal);
    myChart.data.datasets[1].data.push(vibVal);
    
    if (myChart.data.labels.length > 20) {
        myChart.data.labels.shift();
        myChart.data.datasets.forEach(d => d.data.shift());
    }
    myChart.update('none');
}

function updateStatusLight(id, color) {
    const light = document.getElementById(id);
    if(light) {
        light.style.backgroundColor = color;
        light.style.boxShadow = `0 0 10px ${color}`;
    }
}

function stopMonitoring() {
    clearInterval(fetchInterval);
    document.getElementById('connect-btn').style.display = "inline-block";
    document.getElementById('disconnect-btn').style.display = "none";
    document.getElementById('sync-status').innerText = "Paused";
    logEvent("STOPPED: Polling paused.");
}

function logEvent(msg) {
    const list = document.getElementById('event-list');
    if(list) {
        const entry = document.createElement('li');
        entry.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
        list.prepend(entry);
    }
}

function clearHistory() {
    document.getElementById('event-list').innerHTML = "";
}
