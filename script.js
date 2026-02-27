const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS5mqgSHNE1hEN16oy48V5y4MUWB47KwxqAsM-etDURXfswMw3iOXE2gfqpUo4Rni5nF1k0BsANqWXi/pub?gid=387970785&single=true&output=csv"; 

// AI Memory & Analytics
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

        // --- NEW: AUTO-START DETECTION ---
        // If current jumps from 0 to > 0.2A, the motor just started. Recalibrate!
        if (curr > 0.2 && !motorRunning) {
            motorRunning = true;
            resetCalibration(); 
            logEvent("STARTUP: Motor detected. Initializing AI Calibration...");
        } else if (curr < 0.1 && motorRunning) {
            motorRunning = false;
            logEvent("SHUTDOWN: Motor stopped. Entering Standby.");
        }

        document.getElementById('temp-display').innerText = temp.toFixed(1) + "°C";
        document.getElementById('curr-display').innerText = curr.toFixed(2) + "A";
        document.getElementById('vib-display').innerText = vib.toFixed(2) + "G";

        if (!isCalibrated && motorRunning) {
            runCalibration(temp, vib);
        }

        updateStatusLights(temp, curr, vib);
        const health = calculateHealth(temp, curr, vib);
        runAdvancedAI(temp, curr, vib, health);

        // Update Chart (Last 20 points for better visibility)
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
    const act = document.getElementById('ai-action-step');
    
    calibrationBuffer.push({t, v});
    sugg.innerText = `LEARNING BASELINE: ${Math.round((calibrationBuffer.length/6)*100)}%`;
    act.innerText = "Analyzing current motor condition to set reference thresholds...";

    if (calibrationBuffer.length >= 6) {
        ambientBaseline.t = calibrationBuffer.reduce((a, b) => a + b.t, 0) / 6;
        ambientBaseline.v = calibrationBuffer.reduce((a, b) => a + b.v, 0) / 6;
        isCalibrated = true;
        logEvent(`CALIBRATION SUCCESS: Normal Temp set to ${ambientBaseline.t.toFixed(1)}°C`);
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
    const hStatus = document.getElementById('motor-health-status');
    if(hDisplay) {
        hDisplay.innerText = Math.round(score) + "%";
        hDisplay.style.color = score > 80 ? "#00ff88" : score > 50 ? "#ffcc00" : "#ff4444";
        hStatus.innerText = score > 80 ? "Operational" : score > 50 ? "Performance Degraded" : "Critical Failure Imminent";
    }
    return score;
}

function runAdvancedAI(t, c, v, h) {
    if (!isCalibrated || !motorRunning) {
        if (!motorRunning) {
            document.getElementById('ai-suggestion').innerText = "STANDBY MODE";
            document.getElementById('ai-action-step').innerText = "Waiting for motor current to initialize monitoring.";
        }
        return;
    }

    const sugg = document.getElementById('ai-suggestion');
    const act = document.getElementById('ai-action-step');
    
    // Prognostics: Rate of Change
    const tempRate = (t - prevData.t); // Heat gain per 5s

    let diag = "SYSTEM HEALTHY";
    let advice = "Motor running within learned baseline parameters.";
    let anomaly = false;

    // --- PROGNOSTIC LOGIC ---
    if (tempRate > 1.5 && t > ambientBaseline.t + 8) {
        diag = "PROGNOSTIC: THERMAL RUNAWAY";
        advice = `Temp rising at ${tempRate.toFixed(1)}°C/interval. Failure expected in < 2 mins.`;
        anomaly = true;
    }
    else if (v > (ambientBaseline.v + 1.2) && t > (ambientBaseline.t + 5)) {
        diag = "DIAGNOSTIC: BEARING FRICTION";
        advice = "Vibration and heat correlation confirms mechanical wear in bearings.";
        anomaly = true;
    }
    else if (h < 60) {
        diag = "CRITICAL: SYSTEM INSTABILITY";
        advice = "Multiple parameters outside safety envelope. Immediate shutdown advised.";
        anomaly = true;
    }

    if (anomaly) {
        faultPersistenceCounter++;
    } else {
        faultPersistenceCounter = 0;
    }

    if (faultPersistenceCounter >= 2) {
        sugg.innerText = diag;
        act.innerText = advice;
        if (diag !== lastFaultStatus) {
            logEvent(`AI ALERT: ${diag}`);
            lastFaultStatus = diag;
        }
    } else {
        sugg.innerText = "MONITORING ACTIVE";
        act.innerText = "Analyzing live telemetry for micro-deviations.";
        lastFaultStatus = "";
    }
}

// Helper Functions
function updateStatusLights(t, c, v) { setLight('temp-light', t, 48, 55); setLight('curr-light', c, 4.5, 6); setLight('vib-light', v, 1.8, 2.8); }
function setLight(id, val, warn, crit) { 
    const el = document.getElementById(id); 
    if(!el) return; 
    el.className = "status-light " + (val >= crit ? 'critical' : val >= warn ? 'warning' : 'normal'); 
}
function logEvent(msg) {
    const list = document.getElementById('event-list');
    if(!list) return;
    const entry = document.createElement('li');
    entry.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
    list.prepend(entry);
}

setInterval(updateDashboard, 5000);
updateDashboard();
