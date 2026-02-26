const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS5mqgSHNE1hEN16oy48V5y4MUWB47KwxqAsM-etDURXfswMw3iOXE2gfqpUo4Rni5nF1k0BsANqWXi/pub?gid=387970785&single=true&output=csv"; 

// AI Memory for Trend Analysis
let prevData = { t: 0, c: 0, v: 0 };
let lastFaultStatus = "";

// Initialize Chart
const ctx = document.getElementById('myChart').getContext('2d');
let myChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            { 
                label: 'Temp (°C)', 
                data: [], 
                borderColor: '#ff4444', 
                borderWidth: 3,
                pointRadius: 0, 
                tension: 0.3, 
                yAxisID: 'y' 
            },
            { 
                label: 'Current (A)', 
                data: [], 
                borderColor: '#00ccff', 
                borderWidth: 2,
                pointRadius: 0, 
                tension: 0.3, 
                yAxisID: 'y1' 
            },
            { 
                label: 'Vibration (G)', 
                data: [], 
                borderColor: '#00ff88', 
                borderWidth: 2,
                pointRadius: 0, 
                tension: 0.3, 
                yAxisID: 'y1' 
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: { 
                type: 'linear', 
                position: 'left', 
                min: 0, 
                max: 100, 
                title: { display: true, text: 'Temperature °C', color: '#ff4444' },
                grid: { color: '#222' }, 
                ticks: { color: '#888' } 
            },
            y1: { 
                type: 'linear', 
                position: 'right', 
                min: 0, 
                max: 10, 
                title: { display: true, text: 'Amp / G-Force', color: '#00ff88' },
                grid: { display: false }, 
                ticks: { color: '#888' } 
            }
        },
        plugins: { 
            legend: { labels: { color: '#e0e6ed', font: { size: 12 } } } 
        }
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

        // Update Numerical Displays
        document.getElementById('temp-display').innerText = temp.toFixed(1) + "°C";
        document.getElementById('curr-display').innerText = curr.toFixed(2) + "A";
        document.getElementById('vib-display').innerText = vib.toFixed(2) + "G";

        // Logic & Health Calculations
        updateStatusLights(temp, curr, vib);
        const health = calculateHealth(temp, curr, vib);
        runAdvancedAI(temp, curr, vib, health);

        // Update Chart History
        const history = dataRows.slice(-15);
        myChart.data.labels = history.map(r => r.split(',')[0].split(' ')[1] || "Live");
        myChart.data.datasets[0].data = history.map(r => parseFloat(r.split(',')[1]) || 0);
        myChart.data.datasets[1].data = history.map(r => parseFloat(r.split(',')[2]) || 0);
        myChart.data.datasets[2].data = history.map(r => parseFloat(r.split(',')[3]) || 0);
        myChart.update('none');

        // Store current as previous for trend analysis
        prevData = { t: temp, c: curr, v: vib };

    } catch (e) { console.error("Update Error:", e); }
}

function updateStatusLights(t, c, v) {
    setLight('temp-light', t, 46, 51);
    setLight('curr-light', c, 4, 5);
    setLight('vib-light', v, 1.5, 2.5);
}

function setLight(id, val, warn, crit) {
    const el = document.getElementById(id);
    if(!el) return;
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
    const hDisplay = document.getElementById('motor-health-score');
    const hStatus = document.getElementById('motor-health-status');
    
    if(hDisplay) {
        hDisplay.innerText = Math.round(score) + "%";
        if (score > 80) { hDisplay.style.color = "#00ff88"; hStatus.innerText = "Excellent"; }
        else if (score > 50) { hDisplay.style.color = "#ffcc00"; hStatus.innerText = "Maintenance Needed"; }
        else { hDisplay.style.color = "#ff4444"; hStatus.innerText = "Critical Failure Risk"; }
    }
    return score;
}

function runAdvancedAI(t, c, v, h) {
    const sugg = document.getElementById('ai-suggestion');
    const act = document.getElementById('ai-action-step');
    let diag = "SYSTEM HEALTHY";
    let advice = "Operating within normal parameters.";

    // Trend Calculation (Rate of Change)
    const tempRise = t - prevData.t;

    // Advanced Multivariate Logic
    if (t > 51 && v > 2.5) {
        diag = "CRITICAL: BEARING FAILURE RISK";
        advice = "Severe friction detected. Emergency stop required to prevent shaft damage.";
    } 
    else if (c > 5 && tempRise > 2) {
        diag = "WARNING: THERMAL OVERLOAD";
        advice = "Rapid temperature spike with high current. Inspect motor load immediately.";
    }
    else if (v > 2.0 && t < 40) {
        diag = "MECHANICAL: COMPONENT LOOSENESS";
        advice = "High vibration with low heat suggests loose mounting or unbalance.";
    }
    else if (h < 85 && h > 65) {
        diag = "PREDICTIVE: WEAR DETECTED";
        advice = "Early signs of degradation. Schedule maintenance inspection soon.";
    }

    sugg.innerText = diag;
    act.innerText = advice;

    // Log significant changes
    if (diag !== lastFaultStatus && diag !== "SYSTEM HEALTHY") {
        logEvent(`AI ALERT: ${diag}`);
        lastFaultStatus = diag;
    } else if (diag === "SYSTEM HEALTHY" && lastFaultStatus !== "") {
        logEvent("RECOVERY: System returned to nominal baseline.");
        lastFaultStatus = "";
    }
}

function logEvent(msg) {
    const list = document.getElementById('event-list');
    if(!list) return;
    const entry = document.createElement('li');
    // Using the system-init style class logic we defined in CSS for regular logs
    entry.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
    list.prepend(entry);
}

setInterval(updateDashboard, 5000);
updateDashboard();
