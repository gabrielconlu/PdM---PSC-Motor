const url = "https://script.google.com/macros/s/AKfycbzxW6ws7_0IXkqLIeXO6DVeJGnnKudpSJyZUYk4-Nt2yvR16gtCzpK__0gfCqWfxTke/exec"; 

let myChart;
let fetchInterval;
let isMonitoring = false;

// --- 1. INITIALIZATION ---
window.addEventListener('load', () => {
    initChart();
    loadLogsFromStorage(); // I-recover ang logs mula sa browser memory
    logEvent("SYSTEM READY: Dashboard initialized.");
});

function initChart() {
    const canvas = document.getElementById('myChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { 
                    label: 'Temp (°C)', 
                    data: [], 
                    borderColor: '#ef4444', 
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 2, 
                    tension: 0.3, 
                    yAxisID: 'y' 
                },
                { 
                    label: 'Vibration (G)', 
                    data: [], 
                    borderColor: '#22c55e', 
                    borderWidth: 2, 
                    tension: 0.3, 
                    yAxisID: 'y1' 
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { type: 'linear', position: 'left', title: { display: true, text: 'Temp (°C)' }, min: 0 },
                y1: { type: 'linear', position: 'right', display: true, title: { display: true, text: 'Vib (G)' }, min: 0 }
            }
        }
    });
}

// --- 2. PERSISTENT LOGGING SYSTEM ---
function logEvent(msg, type = "") {
    const entryData = {
        time: new Date().toLocaleTimeString(),
        message: msg,
        type: type
    };
    renderLogEntry(entryData);
    saveLogToStorage(entryData);
}

function renderLogEntry(log) {
    const list = document.getElementById('event-list') || document.getElementById('system-logs');
    if (!list) return;
    const entry = document.createElement('div');
    entry.className = "log-entry";
    if (log.type === "error") entry.style.color = "#ef4444";
    entry.innerHTML = `<span class="log-time">[${log.time}]</span> ${log.message}`;
    list.prepend(entry);
}

function saveLogToStorage(log) {
    let logs = JSON.parse(localStorage.getItem('motor_logs')) || [];
    logs.push(log);
    if (logs.length > 50) logs.shift(); 
    localStorage.setItem('motor_logs', JSON.stringify(logs));
}

function loadLogsFromStorage() {
    const logs = JSON.parse(localStorage.getItem('motor_logs')) || [];
    logs.forEach(log => renderLogEntry(log));
}

// --- 3. DATA ACQUISITION ---
async function startMonitoring() {
    isMonitoring = true;
    toggleButtons(true);
    logEvent("MONITORING STARTED: Analyzing live sensor streams...");
    fetchDataFromSheets();
    fetchInterval = setInterval(fetchDataFromSheets, 5000);
}

async function fetchDataFromSheets() {
    if (!isMonitoring) return;
    try {
        const syncLabel = document.getElementById('sync-status');
        const response = await fetch(`${url}?read=true&t=${new Date().getTime()}`);
        const data = await response.json();

        if (data.timestamp) {
            const dataTime = parseSheetDate(data.timestamp).getTime(); 
            const currentTime = new Date().getTime();
            const diffInSeconds = (currentTime - dataTime) / 1000;

            // Strict Check: 30 seconds tolerance para siguradong LIVE data
            if (isNaN(dataTime) || diffInSeconds > 30) { 
                if(syncLabel) { syncLabel.innerText = "Stale Data (Offline)"; syncLabel.style.color = "#fbbf24"; }
                updateDashboard(0, 0, "OFFLINE");
                return; 
            }

            updateDashboard(data.temp, data.vibration || 0, data.status || "Normal");
            if(syncLabel) { syncLabel.innerText = "Live"; syncLabel.style.color = "#22c55e"; }
        }
    } catch (e) {
        logEvent("ERROR: Sync failed", "error");
    }
}

// --- 4. PREDICTIVE ANALYSIS & UI ---
function updateDashboard(t, v, s) {
    const tempVal = parseFloat(t) || 0;
    const vibVal = parseFloat(v) || 0;

    // Update Numerical Displays
    updateTextElement('temp-val', tempVal.toFixed(1), s);
    updateTextElement('vib-val', vibVal.toFixed(2), s);

    // Update Chart
    if (isMonitoring && s !== "OFFLINE" && (tempVal !== 0 || vibVal !== 0)) {
        const now = new Date().toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' });
        myChart.data.labels.push(now);
        myChart.data.datasets[0].data.push(tempVal);
        myChart.data.datasets[1].data.push(vibVal);
        
        if (myChart.data.labels.length > 15) {
            myChart.data.labels.shift();
            myChart.data.datasets.forEach(d => d.data.shift());
        }
        myChart.update('none');
    }

    // --- LINEAR REGRESSION LOGIC ---
    const tempSlope = calculateSlope(myChart.data.datasets[0].data.slice(-10));
    const vibSlope = calculateSlope(myChart.data.datasets[1].data.slice(-10));
    
    let currentStatus = "SYSTEM NORMAL";
    let statusClass = "status-normal";
    let actionText = "Motor operating within predicted baseline.";

    if (s === "OFFLINE") {
        currentStatus = "DISCONNECTED";
        statusClass = "status-idle";
        actionText = "No recent data detected. Check hardware connection.";
    } 
    // CAPACITOR FAULT LOGIC: High Vib Trend + Rapid Temp Rise
    else if (vibSlope > 0.15 && tempSlope > 0.4) {
        currentStatus = "POTENTIAL CAPACITOR FAULT";
        statusClass = "status-warning";
        actionText = `⚠️ <b>PREDICTIVE ALERT:</b> Unstable vibration + rising temp. Possible capacitor failure (No burning smell).`;
    }
    // THERMAL RUNAWAY LOGIC: Extreme Slope
    else if (tempVal >= 85 && tempSlope > 0.5) {
        currentStatus = "THERMAL RUNAWAY";
        statusClass = "status-critical";
        actionText = `🚨 <b>CRITICAL:</b> Dangerous temperature trend (+${tempSlope.toFixed(2)}°/sample). Shut down now!`;
    }

    const statLabel = document.getElementById('status-label');
    const aiAction = document.getElementById('ai-action-step');
    if(statLabel) { statLabel.innerText = currentStatus; statLabel.className = "status-text " + statusClass; }
    if(aiAction) aiAction.innerHTML = actionText;
}

// --- 5. HELPERS ---
function calculateSlope(data) {
    if (!data || data.length < 3) return 0; 
    const n = data.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
        sumX += i; sumY += data[i];
        sumXY += i * data[i]; sumX2 += i * i;
    }
    const den = (n * sumX2 - sumX * sumX);
    return den === 0 ? 0 : (n * sumXY - sumX * sumY) / den;
}

function parseSheetDate(dateStr) {
    let d = new Date(dateStr);
    if (isNaN(d.getTime())) {
        let parts = dateStr.split(/[\s,/-]+/);
        if (parts.length >= 3) d = new Date(parts[2], parts[0] - 1, parts[1], parts[3] || 0, parts[4] || 0, parts[5] || 0);
    }
    return d;
}

function toggleButtons(monitoring) {
    const connBtn = document.getElementById('connect-btn');
    const discBtn = document.getElementById('disconnect-btn');
    if(connBtn) connBtn.style.display = monitoring ? 'none' : 'inline-block';
    if(discBtn) discBtn.style.display = monitoring ? 'inline-block' : 'none';
}

function updateTextElement(id, val, status) {
    const el = document.getElementById(id);
    if(el) el.innerText = (status === "OFFLINE") ? "0.0" : val;
}

function stopMonitoring() {
    isMonitoring = false;
    clearInterval(fetchInterval);
    updateDashboard(0, 0, "OFFLINE");
    logEvent("PAUSED: Monitoring stopped.");
    toggleButtons(false);
}
