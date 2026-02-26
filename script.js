const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS5mqgSHNE1hEN16oy48V5y4MUWB47KwxqAsM-etDURXfswMw3iOXE2gfqpUo4Rni5nF1k0BsANqWXi/pub?gid=387970785&single=true&output=csv"; 

// Initialize Chart
const ctx = document.getElementById('myChart').getContext('2d');
let myChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            { label: 'Temp', data: [], borderColor: '#ff4444', borderWidth: 2, pointRadius: 0, tension: 0.3, yAxisID: 'y' },
            { label: 'Current', data: [], borderColor: '#00ccff', borderWidth: 2, pointRadius: 0, tension: 0.3, yAxisID: 'y1' },
            { label: 'Vibration', data: [], borderColor: '#00ff88', borderWidth: 2, pointRadius: 0, tension: 0.3, yAxisID: 'y1' }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: { type: 'linear', position: 'left', grid: { color: '#222' }, ticks: { color: '#888' } },
            y1: { type: 'linear', position: 'right', grid: { display: false }, ticks: { color: '#888' } }
        },
        plugins: { legend: { labels: { color: '#888' } } }
    }
});

let lastFaultStatus = "";

async function updateDashboard() {
    try {
        const response = await fetch(url);
        const data = await response.text();
        const rows = data.split('\n').filter(r => r.trim() !== "");
        
        const lastRow = rows[rows.length - 1].split(',');
        const temp = parseFloat(lastRow[1]);
        const curr = parseFloat(lastRow[2]);
        const vib = parseFloat(lastRow[3]);

        // Update Displays
        document.getElementById('temp-display').innerText = temp.toFixed(1) + "°C";
        document.getElementById('curr-display').innerText = curr.toFixed(2) + "A";
        document.getElementById('vib-display').innerText = vib.toFixed(2) + "G";

        // Logic & Health
        updateStatusLights(temp, curr, vib);
        const health = calculateHealth(temp, curr, vib);
        runAIDiagnostic(temp, curr, vib, health);

        // Update Chart
        const history = rows.slice(-15);
        myChart.data.labels = history.map(r => r.split(',')[0].split(' ')[1] || "Time");
        myChart.data.datasets[0].data = history.map(r => parseFloat(r.split(',')[1]));
        myChart.data.datasets[1].data = history.map(r => parseFloat(r.split(',')[2]));
        myChart.data.datasets[2].data = history.map(r => parseFloat(r.split(',')[3]));
        myChart.update('none');

    } catch (e) { console.error("Fetch Error:", e); }
}

function updateStatusLights(t, c, v) {
    setLight('temp-light', t, 46, 51);
    setLight('curr-light', c, 4, 5);
    setLight('vib-light', v, 1.5, 2.5);
}

function setLight(id, val, warn, crit) {
    const el = document.getElementById(id);
    el.className = "status-light";
    if (val >= crit) el.classList.add('critical');
    else if (val >= warn) el.classList.add('warning');
    else el.classList.add('normal');
}

function calculateHealth(t, c, v) {
    let score = 100;
    if (t > 45) score -= (t - 45) * 2;
    if (c > 4) score -= (c - 4) * 10;
    if (v > 1.5) score -= (v - 1.5) * 15;
    
    score = Math.max(0, Math.min(100, score));
    const hDisplay = document.getElementById('health-score');
    hDisplay.innerText = Math.round(score) + "%";
    
    if (score > 80) { hDisplay.style.color = "#00ff88"; document.getElementById('health-status').innerText = "Excellent"; }
    else if (score > 50) { hDisplay.style.color = "#ffcc00"; document.getElementById('health-status').innerText = "Fair - Maintenance Needed"; }
    else { hDisplay.style.color = "#ff4444"; document.getElementById('health-status').innerText = "Critical Failure Risk"; }
    
    return score;
}

function runAIDiagnostic(t, c, v, h) {
    const sugg = document.getElementById('ai-suggestion');
    const act = document.getElementById('ai-action-step');
    let currentFault = "";

    if (t > 51 && v > 2.5) {
        currentFault = "Bearing/Mechanical Failure";
        sugg.innerText = `CRITICAL: ${currentFault}`;
        act.innerText = "Recommendation: Emergency Stop. Inspect bearing friction.";
    } else if (c > 5) {
        currentFault = "Winding Overload";
        sugg.innerText = `CRITICAL: ${currentFault}`;
        act.innerText = "Recommendation: Check motor load and run capacitor.";
    } else if (h < 80) {
        currentFault = "Pre-emptive Maintenance Warning";
        sugg.innerText = "NOTICE: Early Degradation Detected";
        act.innerText = "Recommendation: Schedule routine check of fan and bolts.";
    } else {
        sugg.innerText = "SYSTEM HEALTHY: Normal Operation";
        act.innerText = "No immediate action required.";
    }

    if (currentFault !== "" && currentFault !== lastFaultStatus) {
        logEvent(`ALERT: ${currentFault}`);
        lastFaultStatus = currentFault;
    }
}

function logEvent(msg) {
    const list = document.getElementById('event-list');
    const entry = document.createElement('li');
    entry.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
    list.prepend(entry);
}

setInterval(updateDashboard, 5000);
updateDashboard();
