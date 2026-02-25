//Google Sheets Published CSV URL
const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQZ4RAbDV_zdiENaCEDKp5odFi63367H8k9BhfuAhDrp-8FFtK1Ccy6mVM-uIjsHaT_PYa5hZFSAkSl/pub?gid=0&single=true&output=csv"; 

//Initialize the Chart
const ctx = document.getElementById('myChart').getContext('2d');
let myChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [], // Time will go here
        datasets: [
            {
                label: 'Temperature (°C)',
                data: [],
                borderColor: '#ff4444', // Red-ish
                backgroundColor: 'transparent',
                borderWidth: 2,
                yAxisID: 'y'
            },
            {
                label: 'Current (A)',
                data: [],
                borderColor: '#00ccff', // Blue-ish
                backgroundColor: 'transparent',
                borderWidth: 2,
                yAxisID: 'y1' // Use a second axis because Amps are smaller than Temp
            },
            {
                label: 'Vibration (G)',
                data: [],
                borderColor: '#00ff88', // Green-ish
                backgroundColor: 'transparent',
                borderWidth: 2,
                yAxisID: 'y1'
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Temp' } },
            y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Amps/G-Force' } }
        }
    }
});

//Main function to fetch and update
async function updateDashboard() {
    try {
        const response = await fetch(url);
        const data = await response.text();
        const rows = data.split('\n').filter(row => row.trim() !== ""); // Clean empty rows
        
        // --- UPDATE CARDS (Last row only) ---
        const lastRow = rows[rows.length - 1].split(','); 
        const temp = parseFloat(lastRow[1]);
        const curr = parseFloat(lastRow[2]);
        const vib = parseFloat(lastRow[3]); 

        document.getElementById('temp-display').innerText = temp.toFixed(1) + "°C";
        document.getElementById('curr-display').innerText = curr.toFixed(2) + "A";
        document.getElementById('vib-display').innerText = vib.toFixed(2) + " G";

        updateStatus('temp-light', temp, 50, 60);
        updateStatus('curr-light', curr, 4, 5);
        updateStatus('vib-light', vib, 1.5, 2.5);

        // --- UPDATE CHART (Last 15 rows) ---
        const history = rows.slice(-15); // Get last 15 readings
        const labels = [];
        const tempPoints = [];
        const currPoints = [];
        const vibPoints = [];

        history.forEach(row => {
            const cols = row.split(',');
            labels.push(cols[0].split(' ')[1] || cols[0]); // Take just the Time part of the timestamp
            tempPoints.push(parseFloat(cols[1]));
            currPoints.push(parseFloat(cols[2]));
            vibPoints.push(parseFloat(cols[3]));
        });

        myChart.data.labels = labels;
        myChart.data.datasets[0].data = tempPoints;
        myChart.data.datasets[1].data = currPoints;
        myChart.data.datasets[2].data = vibPoints;
        myChart.update();

    } catch (e) {
        console.error("Data fetch failed:", e);
    }
}

//Status Light Helper
function updateStatus(id, value, warn, crit) {
    const light = document.getElementById(id);
    if (!light) return;
    light.className = "status-light"; 
    if (value >= crit) light.classList.add('critical');
    else if (value >= warn) light.classList.add('warning');
    else light.classList.add('normal');
}

//Start Polling
setInterval(updateDashboard, 3000);
updateDashboard();