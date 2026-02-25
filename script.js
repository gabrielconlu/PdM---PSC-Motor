const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS5mqgSHNE1hEN16oy48V5y4MUWB47KwxqAsM-etDURXfswMw3iOXE2gfqpUo4Rni5nF1k0BsANqWXi/pub?gid=387970785&single=true&output=csv"; 

// Initialize Chart
// Replace the Chart initialization in your script.js with this:
const ctx = document.getElementById('myChart').getContext('2d');

let myChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [], // Time stamps
        datasets: [
            {
                label: 'Temp',
                data: [],
                borderColor: '#ff4444',
                borderWidth: 2,
                pointRadius: 0, // Hides the dots for a cleaner line
                tension: 0.3,   // Smooths the line
                fill: false
            },
            {
                label: 'Current',
                data: [],
                borderColor: '#00ccff',
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.3,
                fill: false
            },
            {
                label: 'Vibration',
                data: [],
                borderColor: '#00ff88',
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.3,
                fill: false
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'top',
                labels: { color: '#888', font: { size: 12 } }
            }
        },
        scales: {
            x: {
                grid: { display: false }, // Hide vertical lines for simplicity
                ticks: { color: '#555', maxRotation: 0 }
            },
            y: {
                grid: { color: '#222' }, // Very faint horizontal lines
                ticks: { color: '#555' },
                title: { display: false }
            }
        }
    }
});

async function updateDashboard() {
    try {
        const response = await fetch(url);
        const data = await response.text();
        const rows = data.split('\n').filter(r => r.trim() !== "");
        
        // 1. Get Latest Values
        const lastRow = rows[rows.length - 1].split(',');
        const temp = parseFloat(lastRow[1]);
        const curr = parseFloat(lastRow[2]);
        const vib = parseFloat(lastRow[3]);

        // 2. Update Display Numbers
        document.getElementById('temp-display').innerText = temp.toFixed(1) + "°C";
        document.getElementById('curr-display').innerText = curr.toFixed(2) + "A";
        document.getElementById('vib-display').innerText = vib.toFixed(2) + "G";

        // 3. Update Status Lights
        updateStatus('temp-light', temp, 46, 51); // Warning 46, Critical 51
        updateStatus('curr-light', curr, 4, 5);
        updateStatus('vib-light', vib, 1.5, 2.5);

        // 4. Run AI Diagnostic Engine
        runAIDiagnostic(temp, curr, vib);

        // 5. Update Historical Chart (Last 15 rows)
        const history = rows.slice(-15);
        myChart.data.labels = history.map(r => r.split(',')[0].split(' ')[1] || "Time");
        myChart.data.datasets[0].data = history.map(r => parseFloat(r.split(',')[1]));
        myChart.data.datasets[1].data = history.map(r => parseFloat(r.split(',')[2]));
        myChart.data.datasets[2].data = history.map(r => parseFloat(r.split(',')[3]));
        myChart.update('none');

    } catch (e) { console.error("Fetch Error:", e); }
}

function updateStatus(id, val, warn, crit) {
    const el = document.getElementById(id);
    el.className = "status-light";
    if (val >= crit) el.classList.add('critical');
    else if (val >= warn) el.classList.add('warning');
    else el.classList.add('normal');
}

function runAIDiagnostic(t, c, v) {
    const sugg = document.getElementById('ai-suggestion');
    const act = document.getElementById('ai-action-step');

    if (t > 51 && v > 2.5) {
        sugg.innerText = "CRITICAL: Potential Bearing Failure";
        act.innerText = "Action: Mechanical friction detected. Shutdown and lubricate bearings.";
    } else if (c > 5 && t > 51) {
        sugg.innerText = "CRITICAL: Motor Winding Overload";
        act.innerText = "Action: High heat and current detected. Reduce load or check capacitor.";
    } else if (v > 1.5 && v <= 2.5) {
        sugg.innerText = "PREDICTIVE: Component Loosening";
        act.innerText = "Action: Slight vibration detected. Check mounting bolts soon.";
    } else if (t > 46 && t <= 51) {
        sugg.innerText = "PREDICTIVE: Cooling Inefficiency";
        act.innerText = "Action: Temperature rising. Check air vents for blockage.";
    } else {
        sugg.innerText = "SYSTEM HEALTHY: Normal Operation";
        act.innerText = "Action: No maintenance required at this time.";
    }
}

setInterval(updateDashboard, 5000);
updateDashboard();
