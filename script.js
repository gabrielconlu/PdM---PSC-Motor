const url = "https://script.google.com/macros/s/AKfycbzxW6ws7_0IXkqLIeXO6DVeJGnnKudpSJyZUYk4-Nt2yvR16gtCzpK__0gfCqWfxTke/exec";

let myChart;
let fetchInterval;
let isMonitoring = false;
let isFetching = false;

const FETCH_INTERVAL_MS = 3000;

// ================= INIT =================
window.addEventListener('load', () => {
    initChart();
    logEvent("SYSTEM READY");
});

// ================= CHART =================
function initChart() {
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
                    tension: 0.3
                },
                {
                    label: 'Vibration (x1000)',
                    data: [],
                    borderColor: '#22c55e',
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

// ================= START =================
function startMonitoring() {
    if (fetchInterval) clearInterval(fetchInterval);

    isMonitoring = true;
    logEvent("MONITORING STARTED");

    fetchData();

    fetchInterval = setInterval(fetchData, FETCH_INTERVAL_MS);
}

// ================= FETCH DATA =================
async function fetchData() {

    if (!isMonitoring || isFetching) return;
    isFetching = true;

    try {

        const response = await fetch(url + "?t=" + Date.now());
        const text = await response.text();

        console.log("RESPONSE:", text);

        const syncStatus = document.getElementById("sync-status");

        // ================= HANDLE SERVER RESPONSE =================
        if (text.includes("ERROR") || text.includes("MISSING") || text.includes("NO_")) {
            if (syncStatus) syncStatus.innerText = "Error";
            logEvent("SERVER ERROR: " + text, "error");
            return;
        }

        // Apps Script returns only "OK"
        if (text.trim() !== "OK") {
            logEvent("UNKNOWN RESPONSE: " + text);
        }

        // ================= READ ESP32 VALUES FROM UI OR CACHE =================
        // IMPORTANT: since Apps Script does NOT return data,
        // we assume ESP32 is updating sheet, and we READ INDIRECTLY via logs.

        // For now we simulate "latest known values"
        // (YOU MUST replace this with proper sheet reader later if needed)

        const tempEl = document.getElementById("temp-val");
        const vibEl = document.getElementById("vib-val");

        const temp = parseFloat(tempEl?.innerText || 0);
        const vib = parseFloat(vibEl?.innerText || 0);

        updateDashboard(temp, vib, "LIVE");

        if (syncStatus) syncStatus.innerText = "Live";

    } catch (err) {

        console.error(err);

        const syncStatus = document.getElementById("sync-status");
        if (syncStatus) syncStatus.innerText = "Offline";

        logEvent("NETWORK ERROR", "error");

    } finally {
        isFetching = false;
    }
}

// ================= DASHBOARD UPDATE =================
function updateDashboard(temp, vib, status) {

    const t = parseFloat(temp) || 0;
    const v = parseFloat(vib) || 0;

    // DISPLAY (accurate formatting)
    document.getElementById("temp-val").innerText = t.toFixed(2);
    document.getElementById("vib-val").innerText = v.toFixed(4);

    // SCALE vibration for visibility
    const vibScaled = v * 1000;

    const time = new Date().toLocaleTimeString();

    myChart.data.labels.push(time);
    myChart.data.datasets[0].data.push(t);
    myChart.data.datasets[1].data.push(vibScaled);

    // keep last 20 points
    if (myChart.data.labels.length > 20) {
        myChart.data.labels.shift();
        myChart.data.datasets.forEach(d => d.data.shift());
    }

    myChart.update('none');

    document.getElementById("status-label").innerText = status;
}

// ================= LOGGING =================
function logEvent(msg, type = "") {
    console.log(`[${type}] ${msg}`);
}

// ================= STOP =================
function stopMonitoring() {
    isMonitoring = false;
    clearInterval(fetchInterval);

    document.getElementById("status-label").innerText = "STOPPED";
    logEvent("MONITORING STOPPED");
}
