const url = "https://script.google.com/macros/s/AKfycbzxW6ws7_0IXkqLIeXO6DVeJGnnKudpSJyZUYk4-Nt2yvR16gtCzpK__0gfCqWfxTke/exec";
let myChart;
let isFetching = false;

// 1. Initialize Dashboard & Chart
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
                y: { 
                    grid: { color: 'rgba(255,255,255,0.05)' }, 
                    ticks: { color: '#94a3b8' } 
                },
                x: { 
                    grid: { display: false }, 
                    ticks: { color: '#94a3b8' } 
                }
            },
            plugins: {
                legend: { labels: { color: '#f8fafc' } }
            }
        }
    });

    // Auto-refresh every 3 seconds
    setInterval(fetchLatestData, 3000);
    fetchLatestData();
};

// 2. Data Fetching & Maintenance Logic
async function fetchLatestData() {
    if (isFetching) return;
    isFetching = true;

    try {
        const response = await fetch(`${url}?read=true&t=${Date.now()}`);
        const data = await response.json();

        if (data.error) throw new Error(data.error);

        // --- UPDATE NUMERICAL VALUES ---
        document.getElementById("temp-value").innerText = parseFloat(data.temp || 0).toFixed(1);
        document.getElementById("vib-value").innerText = parseFloat(data.vibration || 0).toFixed(3);
        
        // --- MAINTENANCE ENGINE ---
        // Kinukuha ang status na sinulat ng ESP32 sa Google Sheet
        const tStatus = String(data.tempStatus).toUpperCase(); 
        const vStatus = String(data.vibStatus).toUpperCase();
        
        let mainStatusText = "SYSTEM NORMAL";
        let adviceText = "Motor is operating within safe parameters. No maintenance needed.";
        let themeColor = "#3b82f6"; // Blue (Normal)

        // Scenario: Parehong Fault
        if (tStatus === "OVERHEATING" && vStatus === "BLOCKED_BEARING") {
            mainStatusText = "CRITICAL: DOUBLE FAULT";
            adviceText = "SHUTDOWN IMMEDIATELY! Excessive friction & heat detected. Inspect bearings & fan.";
            themeColor = "#ef4444"; // Red
        } 
        // Scenario: Init lang
        else if (tStatus === "OVERHEATING") {
            mainStatusText = "WARNING: OVERHEATING";
            adviceText = "Check air vents for dust or blockage. Verify if the cooling fan is spinning.";
            themeColor = "#fbbf24"; // Yellow
        } 
        // Scenario: Vibration lang
        else if (vStatus === "BLOCKED_BEARING") {
            mainStatusText = "WARNING: BLOCKED BEARING";
            adviceText = "Mechanical friction detected. Lubricate the shaft or check for internal obstructions.";
            themeColor = "#fbbf24"; // Yellow
        }

        // Apply Colors and Text to UI
        const labelEl = document.getElementById("status-label");
        const adviceEl = document.getElementById("ai-action-step");
        
        if (labelEl) {
            labelEl.innerText = mainStatusText;
            labelEl.style.color = themeColor;
        }
        if (adviceEl) adviceEl.innerText = adviceText;

        // --- UPDATE CHART ---
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        myChart.data.labels.push(time);
        myChart.data.datasets[0].data.push(data.temp);
        myChart.data.datasets[1].data.push(data.vibration);
        
        // Keep only the last 15 data points to maintain performance
        if (myChart.data.labels.length > 15) {
            myChart.data.labels.shift();
            myChart.data.datasets.forEach(d => d.data.shift());
        }
        myChart.update();

        // Sync Indicator
        const sync = document.getElementById("sync-status");
        if (sync) {
            sync.innerText = "● LIVE";
            sync.style.color = "#22c55e";
        }

    } catch (e) {
        console.error("Cloud Sync Error:", e);
        const sync = document.getElementById("sync-status");
        if (sync) {
            sync.innerText = "○ OFFLINE";
            sync.style.color = "#ef4444";
        }
    } finally {
        isFetching = false;
    }
}
