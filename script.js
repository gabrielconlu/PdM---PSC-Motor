const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS5mqgSHNE1hEN16oy48V5y4MUWB47KwxqAsM-etDURXfswMw3iOXE2gfqpUo4Rni5nF1k0BsANqWXi/pub?gid=387970785&single=true&output=csv"; 

// AI Memory & Master's Level Analytics Variables
let prevData = { t: 0, c: 0, v: 0 };
let lastFaultStatus = "";
let rollingTempBaseline = []; // For Dynamic Thresholding
let faultPersistenceCounter = 0; // Debouncing to prevent false positives

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

        updateStatusLights(temp, curr, vib);
        const health = calculateHealth(temp, curr, vib);
        
        // Advanced AI Logic Execution
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

function calculateHealth(t, c, v) {
    let score = 100;
    if (t > 45) score -= (t - 45) * 2;
    if (c > 4) score -= (c - 4) * 10;
    if (v > 1.5) score -= (v - 1.5) * 15;
    score = Math.max(0, Math.min(100, score));
    
    const hDisplay = document.getElementById('motor-health-score');
    const hStatus = document.getElementById('motor-health-status');
    if(hDisplay) {
        hDisplay.innerText = Math.round(score) + "%";
        hDisplay.style.color = score > 80 ? "#00ff88" : score > 50 ? "#ffcc00" : "#ff4444";
        hStatus.innerText = score > 80 ? "Excellent" : score > 50 ? "Maintenance Needed" : "Critical Failure Risk";
    }
    return score;
}

function runAdvancedAI(t, c, v, h) {
    const sugg = document.getElementById('ai-suggestion');
    const act = document.getElementById('ai-action-step');
    
    // 1. DYNAMIC BASELINE CALCULATION (Master's Prep)
    rollingTempBaseline.push(t);
    if(rollingTempBaseline.length > 10) rollingTempBaseline.shift();
    const avgTemp = rollingTempBaseline.reduce((a, b) => a + b) / rollingTempBaseline.length;
    
    // 2. RATE OF CHANGE (RoC) ANALYSIS
    const tempRateOfChange = t - prevData.t;
    const vibRateOfChange = v - prevData.v;

    let diag = "SYSTEM HEALTHY";
    let advice = "Condition-based monitoring active. No anomalies.";
    let anomalyDetected = false;

    // HEURISTIC INFERENCE ENGINE
    if (t > (avgTemp + 5) && vibRateOfChange > 0.3) {
        diag = "PROGNOSTIC: UNUSUAL THERMAL DRIFT";
        advice = "Temp is rising faster than baseline with vibration spikes. Check bearings.";
        anomalyDetected = true;
    } 
    else if (t > 51 && v > 2.5) {
        diag = "CRITICAL: MECHANICAL SEIZURE RISK";
        advice = "High friction detected. Emergency stop advised to prevent winding burnout.";
        anomalyDetected = true;
    }
    else if (c > 5 && tempRateOfChange > 1.5) {
        diag = "ALGORITHM ALERT: THERMAL RUNAWAY";
        advice = "Current surge correlated with rapid heat increase. Inspect ventilation.";
        anomalyDetected = true;
    }
    else if (h < 85 && h > 70) {
        diag = "PREDICTIVE: EARLY STAGE WEAR";
        advice = "Health score degrading. Plan inspection within next 50 operating hours.";
        anomalyDetected = true;
    }

    // 3. DEBOUNCING / PERSISTENCE LOGIC (Panel-Suggested Reliability)
    if (anomalyDetected) {
        faultPersistenceCounter++;
    } else {
        faultPersistenceCounter = 0;
    }

    if (faultPersistenceCounter >= 2) { // Must be true for 2 consecutive cycles
        sugg.innerText = diag;
        act.innerText = advice;
        if (diag !== lastFaultStatus) {
            logEvent(`AI DIAGNOSTIC: ${diag}`);
            lastFaultStatus = diag;
        }
    } else {
        sugg.innerText = "SYSTEM HEALTHY: Monitoring Patterns...";
        act.innerText = "Heuristic baseline stabilized.";
        lastFaultStatus = "";
    }
}

// ... include updateStatusLights, setLight, and logEvent from previous version ...
function updateStatusLights(t, c, v) { setLight('temp-light', t, 46, 51); setLight('curr-light', c, 4, 5); setLight('vib-light', v, 1.5, 2.5); }
function setLight(id, val, warn, crit) { const el = document.getElementById(id); if(!el) return; el.className = "status-light " + (val >= crit ? 'critical' : val >= warn ? 'warning' : 'normal'); }

setInterval(updateDashboard, 5000);
updateDashboard();
