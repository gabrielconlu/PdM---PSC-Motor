const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS5mqgSHNE1hEN16oy48V5y4MUWB47KwxqAsM-etDURXfswMw3iOXE2gfqpUo4Rni5nF1k0BsANqWXi/pub?gid=387970785&single=true&output=csv"; 

// AI Memory & Master's Level Analytics Variables
let prevData = { t: 0, c: 0, v: 0 };
let lastFaultStatus = "";
let rollingTempBaseline = []; 
let faultPersistenceCounter = 0; 

// --- NEW: Calibration Variables for Aging Motors ---
let isCalibrated = false;
let calibrationBuffer = [];
let ambientBaseline = { t: 0, v: 0 }; 

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
            y: { type: 'linear', position: 'left', min: 0, max: 100, title: { display: true, text: 'Temperature °C', color: '#ff4444' }, grid: { color: '#222' }, ticks: { color: '#888' } },
            y1: { type: 'linear', position: 'right', min: 0, max: 10, title: { display: true, text: 'Amp / G-Force', color: '#00ff88' }, grid: { display: false }, ticks: { color: '#888' } }
        },
        plugins: { legend: { labels: { color: '#e0e6ed', font: { size: 12 } } } }
    }
});

async function updateDashboard() {
    try {
        const response = await fetch(url + "&t=" + new Date().getTime());
        const data = await response.text();
        const rows = data.split('\n').filter(r => r.trim() !== "");
        const dataRows = (isNaN(parseFloat(rows[0].split(',')[1]))) ? rows.slice(1) : rows;
        if (dataRows.length === 0) return;

        const lastRow = dataRows[dataRows.length - 1].split(',');
        const temp = parseFloat(lastRow[1]) || 0;
        const curr = parseFloat(lastRow[2]) || 0;
        const vib = parseFloat(lastRow[3]) || 0;

        document.getElementById('temp-display').innerText = temp.toFixed(1) + "°C";
        document.getElementById('curr-display').innerText = curr.toFixed(2) + "A";
        document.getElementById('vib-display').innerText = vib.toFixed(2) + "G";

        // 1. RUN CALIBRATION FIRST
        if (!isCalibrated) {
            runCalibration(temp, vib);
        }

        updateStatusLights(temp, curr, vib);
        const health = calculateHealth(temp, curr, vib);
        runAdvancedAI(temp, curr, vib, health);

        const history = dataRows.slice(-15);
        myChart.data.labels = history.map(r => r.split(',')[0].split(' ')[1] || "Live");
        myChart.data.datasets[0].data = history.map(r => parseFloat(r.split(',')[1]) || 0);
        myChart.data.datasets[1].data = history.map(r => parseFloat(r.split(',')[2]) || 0);
        myChart.data.datasets[2].data = history.map(r => parseFloat(r.split(',')[3]) || 0);
        myChart.update('none');

        prevData = { t: temp, c: curr, v: vib };
    } catch (e) { console.error("Update Error:", e); }
}

// NEW: Calibration Function
function runCalibration(t, v) {
    const sugg = document.getElementById('ai-suggestion');
    const act = document.getElementById('ai-action-step');
    
    calibrationBuffer.push({t, v});
    sugg.innerText = `CALIBRATING AI... (${calibrationBuffer.length}/6)`;
    act.innerText = "Learning current motor baseline for precision diagnostic.";

    if (calibrationBuffer.length >= 6) {
        ambientBaseline.t = calibrationBuffer.reduce((sum, item) => sum + item.t, 0) / 6;
        ambientBaseline.v = calibrationBuffer.reduce((sum, item) => sum + item.v, 0) / 6;
        isCalibrated = true;
        logEvent(`SYSTEM: Calibration Complete. Baseline: ${ambientBaseline.t.toFixed(1)}°C / ${ambientBaseline.v.toFixed(2)}G`);
    }
}

function calculateHealth(t, c, v) {
    if (!isCalibrated) return 100;

    let score = 100;
    
    // Using Deviation-based scoring instead of fixed thresholds
    const tempDev = t - ambientBaseline.t;
    const vibDev = v - ambientBaseline.v;

    if (tempDev > 5) score -= tempDev * 2;   // Penalty for rising above its own normal
    if (vibDev > 0.5) score -= vibDev * 15;  // Penalty for increased shaking
    if (c > 4) score -= (c - 4) * 10;        // Current remains absolute (electrical limit)
    
    score = Math.max(0, Math.min(100, score));
    
    const hDisplay = document.getElementById('motor-health-score');
    const hStatus = document.getElementById('motor-health-status');
    if(hDisplay) {
        hDisplay.innerText = Math.round(score) + "%";
        hDisplay.style.color = score > 80 ? "#00ff88" : score > 50 ? "#ffcc00" : "#ff4444";
        hStatus.innerText = score > 80 ? "Nominal Baseline" : score > 50 ? "Maintenance Recommended" : "Urgent Intervention Needed";
    }
    return score;
}

function runAdvancedAI(t, c, v, h) {
    if (!isCalibrated) return;

    const sugg = document.getElementById('ai-suggestion');
    const act = document.getElementById('ai-action-step');
    
    rollingTempBaseline.push(t);
    if(rollingTempBaseline.length > 10) rollingTempBaseline.shift();
    const avgTemp = rollingTempBaseline.reduce((a, b) => a + b) / rollingTempBaseline.length;
    
    const tempRateOfChange = t - prevData.t;

    let diag = "SYSTEM HEALTHY";
    let advice = "Heuristic monitoring active. Parameters stabilized.";
    let anomalyDetected = false;

    // AI CORRELATION LOGIC (Data Fusion)
    if (t > (ambientBaseline.t + 10) && v > (ambientBaseline.v + 1.0)) {
        diag = "PROGNOSTIC: ADVANCED BEARING WEAR";
        advice = "Correlation detected: High heat + Increased vibration. Bearing service required.";
        anomalyDetected = true;
    } 
    else if (c > 5 && tempRateOfChange > 1.2) {
        diag = "ALGORITHM: ELECTRICAL OVERLOAD";
        advice = "Rapid thermal spike with high amperage. Check motor load.";
        anomalyDetected = true;
    }
    else if (h < 75) {
        diag = "PREDICTIVE: PERFORMANCE DEVIATION";
        advice = "Motor is operating outside learned baseline. Schedule routine check.";
        anomalyDetected = true;
    }

    if (anomalyDetected) {
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
        sugg.innerText = "SYSTEM HEALTHY: Analysis Active";
        act.innerText = "Baseline deviation within tolerance.";
        lastFaultStatus = "";
    }
}

function updateStatusLights(t, c, v) { 
    // Status lights can stay absolute for safety standards
    setLight('temp-light', t, 46, 51); 
    setLight('curr-light', c, 4, 5); 
    setLight('vib-light', v, 1.5, 2.5); 
}

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
