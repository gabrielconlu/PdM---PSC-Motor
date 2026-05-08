const url = "https://script.google.com/macros/s/AKfycbzxW6ws7_0IXkqLIeXO6DVeJGnnKudpSJyZUYk4-Nt2yvR16gtCzpK__0gfCqWfxTke/exec";
let myChart;
let isFetching = false;

window.onload = () => {
    const ctx = document.getElementById('myChart').getContext('2d');
    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Temperature (°C)',
                    data: [],
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    fill: true,
                    tension: 0.3
                },
                {
                    label: 'Vibration (G)',
                    data: [],
                    borderColor: '#22c55e',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    fill: true,
                    tension: 0.3
                }
            ]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            animation: false,
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
            },
            plugins: {
                legend: { labels: { color: '#f8fafc' } }
            }
        }
    });

    setInterval(fetchLatestData, 3000);
    fetchLatestData();
};

async function fetchLatestData() {
    if (isFetching) return;
    isFetching = true;

    try {
        const response = await fetch(url + "?read=true&t=" + Date.now());
        const data = await response.json();

        if (data.error) throw new Error(data.error);

        // 1. Update Numerical Values
        document.getElementById("temp-value").innerText = parseFloat(data.temp).toFixed(1);
        document.getElementById("vib-value").innerText = parseFloat(data.vibration).toFixed(3);
        
        // 2. MAINTENANCE ENGINE (Logic based on Google Sheet Status)
        const tStatus = data.tempStatus; 
        const vStatus = data.vibStatus;
        
        let mainStatusText = "SYSTEM NORMAL";
        let adviceText = "Motor is running within safe parameters.";
        let themeColor = "#3b82f6"; // Default Blue

        if (tStatus === "OVERHEATING" && vStatus === "BLOCKED_BEARING") {
            mainStatusText = "CRITICAL: DOUBLE FAULT";
            adviceText = "SHUTDOWN IMMEDIATELY! Check bearings and cooling system.";
            themeColor = "#ef4444"; // Red
        } else if (tStatus === "OVERHEATING") {
            mainStatusText = "WARNING: OVERHEATING";
            adviceText = "Check cooling fan and air vents for obstructions.";
            themeColor = "#fbbf24"; // Yellow
        } else if (vStatus === "BLOCKED_BEARING") {
            mainStatusText = "WARNING: BLOCKED BEARING";
            adviceText = "Lubricate motor shaft or check for mechanical blockages.";
            themeColor = "#fbbf24"; // Yellow
        }

        // Apply Logic to HTML Elements
        const labelEl = document.getElementById("status-label");
        const adviceEl = document.getElementById("ai-action-step");
        
        labelEl.innerText = mainStatusText;
        labelEl.style.color = themeColor;
        adviceEl.innerText = adviceText;

        // 3. Update Chart
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        myChart.data.labels.push(time);
        myChart.data.datasets[0].data.push(data.temp);
        myChart.data.datasets[1].data.push(data.vibration);
        
        if (myChart.data.labels.length > 15) {
            myChart.data.labels.shift();
            myChart.data.datasets.forEach(d => d.data.shift());
        }
        myChart.update();

        // 4. Sync Status Indicator
        const sync = document.getElementById("sync-status");
        sync.innerText = "● LIVE";
        sync.style.color = "#22c55e";

    } catch (e) {
        console.error("Fetch error:", e);
        const sync = document.getElementById("sync-status");
        sync.innerText = "○ OFFLINE";
        sync.style.color = "#ef4444";
    }
    
    isFetching = false;
}
