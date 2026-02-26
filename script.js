const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS5mqgSHNE1hEN16oy48V5y4MUWB47KwxqAsM-etDURXfswMw3iOXE2gfqpUo4Rni5nF1k0BsANqWXi/pub?gid=387970785&single=true&output=csv"; 

// AI MEMORY for Trend Analysis
let prevData = { t: 0, c: 0, v: 0 };
let lastFaultStatus = "Normal";

// Initialize Chart (Keeping your dual-axis setup)
const ctx = document.getElementById('myChart').getContext('2d');
let myChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            { label: 'Temp', data: [], borderColor: '#ff4444', yAxisID: 'y', tension: 0.3, pointRadius: 0 },
            { label: 'Current', data: [], borderColor: '#00ccff', yAxisID: 'y1', tension: 0.3, pointRadius: 0 },
            { label: 'Vibration', data: [], borderColor: '#00ff88', yAxisID: 'y1', tension: 0.3, pointRadius: 0 }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: { type: 'linear', position: 'left', min: 0, max: 100, ticks: { color: '#888' } },
            y1: { type: 'linear', position: 'right', min: 0, max: 10, grid: { display: false }, ticks: { color: '#888' } }
        }
    }
});

async function updateDashboard() {
    try {
        const response = await fetch(url + "&t=" + new Date().getTime());
        const text = await response.text();
        const rows = text.split('\n').filter(r => r.trim() !== "");
        const dataRows = (isNaN(parseFloat(rows[0].split(',')[1]))) ? rows.slice(1) : rows;

        const lastRow = dataRows[dataRows.length - 1].split(',');
        const t = parseFloat(lastRow[1]) || 0;
        const c = parseFloat(lastRow[2]) || 0;
        const v = parseFloat(lastRow[3]) || 0;

        // 1. Update UI Elements
        document.getElementById('temp-display').innerText = t.toFixed(1) + "°C";
        document.getElementById('curr-display').innerText = c.toFixed(2) + "A";
        document.getElementById('vib-display').innerText = v.toFixed(2) + "G";

        // 2. Run Diagnostic Fusion (The new Brain)
        const health = calculateHealth(t, c, v);
        runAdvancedAI(t, c, v, health);

        // 3. Update Chart
        const history = dataRows.slice(-15);
        myChart.data.labels = history.map(r => r.split(',')[0].split(' ')[1] || "");
        myChart.data.datasets[0].data = history.map(r => parseFloat(r.split(',')[1]));
        myChart.data.datasets[1].data = history.map(r => parseFloat(r.split(',')[2]));
        myChart.data.datasets[2].data = history.map(r => parseFloat(r.split(',')[3]));
        myChart.update('none');

        // Store current as previous for next tick
        prevData = { t, c, v };

    } catch (e) { console.error("Update Error:", e); }
}

function runAdvancedAI(t, c, v, h) {
    const sugg = document.getElementById('ai-suggestion');
    const act = document.getElementById('ai-action-step');
    let diag = "SYSTEM HEALTHY";
    let advice = "Operating within normal parameters.";

    // Trend Calculation
    const tempRise = t - prevData.t;

    // Logic Tree (Multivariate)
    if (t > 51 && v > 2.5) {
        diag = "CRITICAL: BEARING FAILURE RISK";
        advice = "Severe friction detected. Emergency stop required to prevent shaft damage.";
    } 
    else if (c > 5 && tempRise > 2) {
        diag = "WARNING: ELECTRICAL OVERLOAD";
        advice = "Rapid temperature spike with high current. Reduce load immediately.";
    }
    else if (v > 2.0 && t < 40) {
        diag = "MECHANICAL: COMPONENT LOOSENESS";
        advice = "High vibration with low heat suggests loose mounting or unbalance.";
    }
    else if (h < 85 && h > 65) {
        diag = "PREDICTIVE: WEAR DETECTED";
        advice = "Early signs of degradation. Schedule inspection within 48 hours.";
    }

    sugg.innerText = diag;
    act.innerText = advice;

    // Log if status changes
    if (diag !== lastFaultStatus && diag !== "SYSTEM HEALTHY") {
        logEvent(`AI DIAGNOSIS: ${diag}`);
        lastFaultStatus = diag;
    }
}

function calculateHealth(t, c, v) {
    let score = 100;
    if (t > 45) score -= (t - 45) * 2;
    if (c > 4) score -= (c - 4) * 10;
    if (v > 1.5) score -= (v - 1.5) * 15;
    score = Math.max(0, Math.min(100, score));

    const hDisplay = document.getElementById('health-score');
    hDisplay.innerText = Math.round(score) + "%";
    hDisplay.style.color = score > 80 ? "#00ff88" : score > 50 ? "#ffcc00" : "#ff4444";
    return score;
}

function logEvent(msg) {
    const list = document.getElementById('event-list');
    const entry = document.createElement('li');
    entry.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
    list.prepend(entry);
}

setInterval(updateDashboard, 5000);
updateDashboard();
