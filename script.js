const url =
    "https://script.google.com/macros/s/AKfycbzxW6ws7_0IXkqLIeXO6DVeJGnnKudpSJyZUYk4-Nt2yvR16gtCzpK__0gfCqWfxTke/exec";
let myChart;
let isFetching = false;

// 1. Initialize ang Chart pag-load ng page
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

    // Simulan ang auto-fetch
    setInterval(fetchLatestData, 3000);
    fetchLatestData();
};

// 2. Function para kumuha ng data sa Cloud
async function fetchLatestData() {
    if (isFetching) return;
    isFetching = true;

    try {
        const response = await fetch(url + "?read=true&t=" + Date.now());
        const data = await response.json();

        if (data.error) throw new Error(data.error);

        // Update ang mga Numeros sa Dashboard
        document.getElementById("temp-value").innerText = parseFloat(data.temp).toFixed(1);
        document.getElementById("vib-value").innerText = parseFloat(data.vibration).toFixed(3);
        
        // Update ang Status Text (mula sa FPGA)
        document.getElementById("status-label").innerText = "TEMP: " + data.tempStatus;
        document.getElementById("ai-action-step").innerText = "VIB: " + data.vibStatus;

        // Update ang Graph
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        myChart.data.labels.push(time);
        myChart.data.datasets[0].data.push(data.temp);
        myChart.data.datasets[1].data.push(data.vibration);
        
        // Panatilihing 15 points lang ang nakikita sa graph para hindi mag-lag
        if (myChart.data.labels.length > 15) {
            myChart.data.labels.shift();
            myChart.data.datasets.forEach(d => d.data.shift());
        }
        myChart.update();

        // Sync Status Indicator
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
