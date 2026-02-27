const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS5mqgSHNE1hEN16oy48V5y4MUWB47KwxqAsM-etDURXfswMw3iOXE2gfqpUo4Rni5nF1k0BsANqWXi/pub?gid=387970785&single=true&output=csv"; 

// AI Memory & Analytics Variables
let prevData = { t: 0, c: 0, v: 0 };
let lastFaultStatus = "";
let rollingTempBaseline = []; 
let faultPersistenceCounter = 0; 

// Calibration & State Management
let isCalibrated = false;
let calibrationBuffer = [];
let ambientBaseline = { t: 0, v: 0 }; 
let motorRunning = false;

// Initialize Chart
const ctx = document.getElementById('myChart').getContext('2d');
let myChart = new Chart(ctx, {
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
            y: { type: 'linear', position: 'left', min: 0, max: 100, title: { display: true, text: 'Temperature °C', color: '#ff4444' }, grid: { color: '#222' } },
            y1: { type: 'linear', position: 'right', min: 0, max: 10, title: { display: true, text: 'Amp / G-Force', color: '#00ff88' }, grid: { display: false } }
        },
        plugins: { legend: { labels: { color: '#e0e6ed' } } }
    }
});

// --- PERSISTENCE INITIALIZATION ---
window.onload = function() {
    const list = document.getElementById('event-list');
    const savedLogs = JSON.parse(localStorage.getItem('motorLogs')) || [];
    
    // Reverse to show newest at the top
    savedLogs.reverse().forEach(log => {
        const entry = document.createElement('li');
        entry.innerText = log;
        if(list) list.prepend(entry);
    });
    
    logEvent("DASHBOARD ACTIVE: Session restored.");
    updateDashboard(); 
};

async function updateDashboard() {
    try {
        const response = await fetch(url + "&t=" + new Date().getTime());
        const csvData = await response.text();
        const rows = csvData.split('\n').filter(r => r.trim() !== "");
        const dataRows = (isNaN(parseFloat(rows[0].split(',')[1]))) ? rows.slice(1) : rows;
        if (dataRows.length === 0) return;

        const lastRow = dataRows[dataRows.length - 1].split(',');
        const temp = parseFloat(lastRow[1]) || 0;
        const curr = parseFloat(lastRow[2]) || 0;
        const vib = parseFloat(lastRow[3]) || 0;

        // Auto-Start Detection (Threshold at 0.2A)
        if (curr > 0.2 && !motorRunning) {
            motorRunning = true;
            resetCalibration(); 
            logEvent("STARTUP: Motor current detected. Initializing AI...");
        } else if (curr < 0.1 && motorRunning) {
            motorRunning = false;
            logEvent("SHUTDOWN: Motor is now idle.");
        }

        document.getElementById('temp-display').innerText = temp.toFixed(1) + "°C";
        document.getElementById('curr-display').innerText = curr.toFixed(2) + "A";
        document.getElementById('vib-display').innerText = vib.toFixed(2) + "G";

        if (!isCalibrated && motorRunning) runCalibration(temp, vib);

        updateStatusLights(temp, curr, vib);
        const health = calculateHealth(temp, curr, vib);
        runAdvancedAI(temp, curr, vib, health);

        // Update Chart
        const history = dataRows.slice(-20);
        myChart.data.labels = history.map(r => r.split(',')[0].split(' ')[1] || "Live");
        myChart.data.datasets[0].data = history.map(r => parseFloat(r.split(',')[1]) || 0);
        myChart.data.datasets[1].data = history.map(r => parseFloat(r.split(',')[2]) || 0);
        myChart.data.datasets[2].data = history.map(r => parseFloat(r.split(',')[3]) || 0);
        myChart.update('none');

        prevData = { t: temp, c: curr, v: vib };
    } catch (e) { console.error("Update Error:", e); }
}

function resetCalibration() {
    isCalibrated = false;
    calibrationBuffer = [];
    ambientBaseline = { t: 0, v: 0 };
}

function runCalibration(t, v) {
    const sugg = document.getElementById('ai-suggestion');
    calibrationBuffer.push({t, v});
    sugg.innerText = `LEARNING BASELINE: ${Math.round((calibrationBuffer.length/6)*100)}%`;

    if (calibrationBuffer.length >= 6) {
        ambientBaseline.t = calibrationBuffer.reduce((a, b) => a + b.t, 0) / 6;
        ambientBaseline.v = calibrationBuffer.reduce((a, b) => a + b.v, 0) / 6;
        isCalibrated = true;
        logEvent(`CALIBRATED: Normal set to ${ambientBaseline.t.toFixed(1)}°C / ${ambientBaseline.v.toFixed(2)}G`);
    }
}

function calculateHealth(t, c, v) {
    if (!isCalibrated || !motorRunning) return 100;
    let score = 100;
    const tempDev = t - ambientBaseline.t;
    const vibDev = v - ambientBaseline.v;

    if (tempDev > 5) score -= tempDev * 3; 
    if (vibDev > 0.4) score -= vibDev * 20;
    if (c > 5) score -= (c - 5) * 15;
    
    score = Math.max(0, Math.min(100, score));
    const hDisplay = document.getElementById('motor-health-score');
    if(hDisplay) hDisplay.innerText = Math.round(score) + "%";
    return score;
}

function runAdvancedAI(t, c, v, h) {
    if (!isCalibrated || !motorRunning) return;
    const sugg = document.getElementById('ai-suggestion');
    const act = document.getElementById('ai-action-step');
    const tempRate = (t - prevData.t);

    let diag = "SYSTEM HEALTHY";
    let advice = "Heuristic analysis: Normal Operation";
    let anomaly = false;

    // --- ENHANCED AI DECISION TREE ---
    if (tempRate > 1.5 && t > ambientBaseline.t + 8) {
        diag = "PROGNOSTIC: THERMAL RUNAWAY";
        advice = "Temp rising too fast. Risk of winding melt-down.";
        anomaly = true;
    } 
    else if (v > (ambientBaseline.v + 1.2) && t > (ambientBaseline.t + 5)) {
        diag = "DIAGNOSTIC: BEARING FRICTION";
        advice = "Correlated Heat & Vibration. Maintenance required.";
        anomaly = true;
    }
    else if (v > (ambientBaseline.v + 2.0)) {
        diag = "ALERT: MECHANICAL INSTABILITY";
        advice = "High vibration. Check mounting or shaft alignment.";
        anomaly = true;
    }
    else if (c > 5.0 && t > (ambientBaseline.t + 10)) {
        diag = "CRITICAL: PHASE OVERLOAD";
        advice = "Excessive current causing overheating. Reduce load.";
        anomaly = true;
    }
    else if (t > (ambientBaseline.t + 15) && v < (ambientBaseline.v + 0.5)) {
        diag = "ADVISORY: COOLING OBSTRUCTION";
        advice = "High temp without vibration. Check air vents.";
        anomaly = true;
    }

    if (anomaly) faultPersistenceCounter++;
    else faultPersistenceCounter = 0;

    if (faultPersistenceCounter >= 2) {
        sugg.innerText = diag;
        act.innerText = advice;
        if (diag !== lastFaultStatus) {
            logEvent(`AI ALERT: ${diag}`);
            lastFaultStatus = diag;
        }
    } else {
        sugg.innerText = "MONITORING";
        act.innerText = "Heuristic analysis active.";
    }
}

function logEvent(msg) {
    const list = document.getElementById('event-list');
    if(!list) return;
    const fullMsg = `[${new Date().toLocaleTimeString()}] ${msg}`;
    
    const entry = document.createElement('li');
    entry.innerText = fullMsg;
    list.prepend(entry);

    let logs = JSON.parse(localStorage.getItem('motorLogs')) || [];
    logs.push(fullMsg);
    if(logs.length > 50) logs.shift();
    localStorage.setItem('motorLogs', JSON.stringify(logs));
}

function clearHistory() {
    if(confirm("Clear diagnostic memory?")) {
        localStorage.removeItem('motorLogs');
        location.reload(); 
    }
}

function updateStatusLights(t, c, v) { setLight('temp-light', t, 48, 55); setLight('curr-light', c, 4.5, 6); setLight('vib-light', v, 1.8, 2.8); }
function setLight(id, val, warn, crit) { 
    const el = document.getElementById(id); 
    if(!el) return; 
    el.className = "status-light " + (val >= crit ? 'critical' : val >= warn ? 'warning' : 'normal'); 
}

setInterval(updateDashboard, 5000);
