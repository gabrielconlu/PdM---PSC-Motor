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
        if (type === "error") div.style.color = "#ef4444";
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

// ================= START MONITORING =================
function startMonitoring() {
    if (fetchInterval) clearInterval(fetchInterval);

    isMonitoring = true;

    toggleButtons(true);
    logEvent("MONITORING STARTED");

    fetchDataFromSheets();

    fetchInterval = setInterval(fetchDataFromSheets, FETCH_INTERVAL_MS);
}

// ================= FETCH DATA (STABLE FIX) =================
async function fetchDataFromSheets() {

    if (!isMonitoring || isFetching) return;
    isFetching = true;

    try {

        const response = await fetch(`${url}?t=${Date.now()}`);
        const text = await response.text();

        console.log("RAW RESPONSE:", text);

        const syncLabel = document.getElementById('sync-status');

        // ================= SAFE ERROR DETECTION =================
        if (text.includes("ERROR") ||
            text.includes("MISSING") ||
            text.includes("NO_") ) {

            if (syncLabel) {
                syncLabel.innerText = "Server Error";
                syncLabel.style.color = "#ef4444";
            }

            logEvent("SYNC ERROR: " + text, "error");
            return;
        }

        // ================= SUCCESS CASE =================
        if (text.trim() === "OK") {

            if (syncLabel) {
                syncLabel.innerText = "Live";
                syncLabel.style.color = "#22c55e";
            }

            logEvent("SYNC OK");

        } else {

            if (syncLabel) {
                syncLabel.innerText = "Warning";
                syncLabel.style.color = "#fbbf24";
            }

            logEvent("SYNC RESPONSE: " + text);
        }

    } catch (e) {

        console.error(e);

        const syncLabel = document.getElementById('sync-status');
        if (syncLabel) {
            syncLabel.innerText = "Offline";
            syncLabel.style.color = "#ef4444";
        }

        logEvent("NETWORK ERROR: " + e.message, "error");

    } finally {
        isFetching = false;
    }
}

// ================= DASHBOARD UPDATE =================
function updateDashboard(temp, vib, status, action) {

    const t = parseFloat(temp) || 0;
    const v = parseFloat(vib) || 0;

    const tempEl = document.getElementById("temp-val");
    const vibEl = document.getElementById("vib-val");

    if (tempEl) tempEl.innerText = t.toFixed(1);
    if (vibEl) vibEl.innerText = v.toFixed(3);

    if (isMonitoring && status !== "OFFLINE") {

        const now = new Date().toLocaleTimeString([], {
            hour12: false,
            minute: '2-digit',
            second: '2-digit'
        });

        myChart.data.labels.push(now);
        myChart.data.datasets[0].data.push(t);
        myChart.data.datasets[1].data.push(v);

        if (myChart.data.labels.length > 15) {
            myChart.data.labels.shift();
            myChart.data.datasets.forEach(d => d.data.shift());
        }

        myChart.update('none');
    }

    const statusLabel = document.getElementById("status-label");
    const aiAction = document.getElementById("ai-action-step");

    if (statusLabel) statusLabel.innerText = action;
    if (aiAction) aiAction.innerText = action;
}

// ================= UI HELPERS =================
function toggleButtons(state) {
    const conn = document.getElementById("connect-btn");
    const disc = document.getElementById("disconnect-btn");

    if (conn) conn.style.display = state ? "none" : "inline-block";
    if (disc) disc.style.display = state ? "inline-block" : "none";
}

// ================= STOP =================
function stopMonitoring() {
    isMonitoring = false;

    if (fetchInterval) clearInterval(fetchInterval);

    updateDashboard(0, 0, "OFFLINE", "Stopped");
    logEvent("MONITORING STOPPED");
    toggleButtons(false);
}
