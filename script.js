const url = "https://script.google.com/macros/s/AKfycbzxW6ws7_0IXkqLIeXO6DVeJGnnKudpSJyZUYk4-Nt2yvR16gtCzpK__0gfCqWfxTke/exec";

let myChart;
let fetchInterval;
let isMonitoring = false;

// 🔒 SYNC CONTROL
let isFetching = false;
const FETCH_INTERVAL_MS = 5000;

// ================= INIT =================
window.addEventListener('load', () => {
    initChart();
    loadLogsFromStorage();
    logEvent("SYSTEM READY: Dashboard initialized.");
});

// ================= CHART =================
function initChart() {
    const canvas = document.getElementById('myChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Temp (°C)',
                    data: [],
                    borderColor: '#ef4444',
                    borderWidth: 2,
                    tension: 0.3,
                    yAxisID: 'y'
                },
                {
                    label: 'Vibration (G)',
                    data: [],
                    borderColor: '#22c55e',
                    borderWidth: 2,
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
                    position: 'left',
                    min: 0
                },
                y1: {
                    position: 'right',
                    min: 0
                }
            }
        }
    });
}

// ================= LOGGING =================
function logEvent(msg, type = "") {
    const entry = {
        time: new Date().toLocaleTimeString(),
        message: msg,
        type: type
    };

    const list = document.getElementById('event-list');
    if (list) {
        const div = document.createElement('div');
        div.innerText = `[${entry.time}] ${entry.message}`;
        if (type === "error") div.style.color = "red";
        list.prepend(div);
    }

    let logs = JSON.parse(localStorage.getItem('motor_logs')) || [];
    logs.push(entry);
    if (logs.length > 50) logs.shift();
    localStorage.setItem('motor_logs', JSON.stringify(logs));
}

function loadLogsFromStorage() {
    const logs = JSON.parse(localStorage.getItem('motor_logs')) || [];
    logs.forEach(l => logEvent(l.message, l.type));
}

// ================= START =================
function startMonitoring() {
    if (fetchInterval) clearInterval(fetchInterval);

    isMonitoring = true;
    logEvent("MONITORING STARTED");

    fetchDataFromSheets();

    fetchInterval = setInterval(fetchDataFromSheets, FETCH_INTERVAL_MS);
}

// ================= FETCH DATA (FIXED) =================
async function fetchDataFromSheets() {

    if (!isMonitoring || isFetching) return;
    isFetching = true;

    try {

        const response = await fetch(`${url}?t=${Date.now()}`);
        const text = await response.text(); // 🔥 FIX: NO JSON

        console.log("Server:", text);

        // Only accept OK response
        if (text.trim() !== "OK") {
            throw new Error(text);
        }

        // SUCCESS
        updateSyncStatus("Live", "#22c55e");
        logEvent("SYNC OK");

    } catch (err) {

        console.error(err);
        updateSyncStatus("Error", "#ef4444");
        logEvent("SYNC FAILED: " + err.message, "error");

    } finally {
        isFetching = false;
    }
}

// ================= DASHBOARD UPDATE =================
function updateDashboard(temp, vib, status, action) {

    const t = parseFloat(temp) || 0;
    const v = parseFloat(vib) || 0;

    document.getElementById("temp-val").innerText = t.toFixed(1);
    document.getElementById("vib-val").innerText = v.toFixed(3);

    if (isMonitoring && status !== "OFFLINE") {

        const now = new Date().toLocaleTimeString();

        myChart.data.labels.push(now);
        myChart.data.datasets[0].data.push(t);
        myChart.data.datasets[1].data.push(v);

        if (myChart.data.labels.length > 15) {
            myChart.data.labels.shift();
            myChart.data.datasets.forEach(d => d.data.shift());
        }

        myChart.update('none');
    }

    document.getElementById("status-label").innerText = action;
}

// ================= SYNC STATUS =================
function updateSyncStatus(text, color) {
    const el = document.getElementById("sync-status");
    if (el) {
        el.innerText = text;
        el.style.color = color;
    }
}

// ================= STOP =================
function stopMonitoring() {
    isMonitoring = false;

    if (fetchInterval) clearInterval(fetchInterval);

    logEvent("MONITORING STOPPED");
    updateSyncStatus("Offline", "#fbbf24");
}
