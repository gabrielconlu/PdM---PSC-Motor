let myChart;
let fetchInterval;
let isMonitoring = false;

let isFetching = false;
const FETCH_INTERVAL_MS = 5000;

const FETCH_INTERVAL_MS = 3000;

// ================= INIT =================
window.addEventListener('load', () => {
initChart();
loadLogsFromStorage();
    logEvent("SYSTEM READY: Dashboard initialized.");
    logEvent("SYSTEM READY");
});

// ================= CHART =================
function initChart() {
    const canvas = document.getElementById('myChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const ctx = document.getElementById('myChart').getContext('2d');

myChart = new Chart(ctx, {
type: 'line',
data: {
labels: [],
datasets: [
{
                    label: 'Temp (°C)',
                    label: 'Temp',
data: [],
borderColor: '#ef4444',
                    borderWidth: 2,
                    tension: 0.3,
                    yAxisID: 'y'
                    tension: 0.3
},
{
                    label: 'Vibration (G)',
                    label: 'Vib',
data: [],
borderColor: '#22c55e',
                    borderWidth: 2,
                    tension: 0.3,
                    yAxisID: 'y1'
                    tension: 0.3
}
]
},
options: {
responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                y: { position: 'left', min: 0 },
                y1: { position: 'right', min: 0 }
            }
            maintainAspectRatio: false
}
});
}

// ================= LOGGING =================
function logEvent(msg, type = "") {
    const entry = {
        time: new Date().toLocaleTimeString(),
        message: msg,
        type
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

// ================= START =================
function startMonitoring() {
    if (fetchInterval) clearInterval(fetchInterval);

isMonitoring = true;
    toggleButtons(true);

logEvent("MONITORING STARTED");

fetchDataFromSheets();

fetchInterval = setInterval(fetchDataFromSheets, FETCH_INTERVAL_MS);
}

// ================= FETCH (FIXED STABLE VERSION) =================
// ================= FETCH (FIXED CORE) =================
async function fetchDataFromSheets() {

if (!isMonitoring || isFetching) return;
isFetching = true;

try {

        const syncLabel = document.getElementById('sync-status');

        // 🔥 FORCE NO CACHE (VERY IMPORTANT FIX)
        const response = await fetch(
            `${url}?read=true&t=${Date.now()}&nocache=${Math.random()}`,
            { cache: "no-store" }
        );

        const text = await response.text();

        console.log("RAW RESPONSE:", text);

        // ================= HARD ERROR CHECK =================
        if (!text || text.includes("ERROR") || text.includes("NO_")) {
        const res = await fetch(url + "?read=1&t=" + Date.now());
        const text = await res.text();

            if (syncLabel) {
                syncLabel.innerText = "Server Error";
                syncLabel.style.color = "#ef4444";
            }

            logEvent("SYNC ERROR: " + text, "error");
            return;
        }
        console.log("RAW:", text);

        // 🔴 MUST BE JSON NOW
let data;

try {
data = JSON.parse(text);
} catch (e) {

            // fallback if plain "OK"
            if (text.trim() === "OK") {

                if (syncLabel) {
                    syncLabel.innerText = "Live";
                    syncLabel.style.color = "#22c55e";
                }

                return;
            }

            throw new Error("Invalid JSON: " + text);
            logEvent("INVALID JSON: " + text, "error");
            return;
}

        // ================= VALID DATA =================
        const temp = parseFloat(data.temp) || 0;
        const vib = parseFloat(data.vibration) || 0;

        const status =
            (data.tempStatus || "unknown") + "|" +
            (data.vibStatus || "unknown");

        updateDashboard(temp, vib, "LIVE", status);

        // ================= SYNC STATUS =================
        if (syncLabel) {
            syncLabel.innerText = "Live";
            syncLabel.style.color = "#22c55e";
        if (!data.temp && !data.vibration) {
            logEvent("EMPTY DATA", "error");
            return;
}

        // ================= FORCE CHART UPDATE EVERY FETCH =================
        const now = new Date().toLocaleTimeString([], {
            hour12: false,
            minute: '2-digit',
            second: '2-digit'
        });

        myChart.data.labels.push(now);
        myChart.data.datasets[0].data.push(temp);
        myChart.data.datasets[1].data.push(vib);

        if (myChart.data.labels.length > 20) {
            myChart.data.labels.shift();
            myChart.data.datasets.forEach(d => d.data.shift());
        }
        updateDashboard(
            data.temp,
            data.vibration,
            data.status || "OK"
        );

        myChart.update('none');
        const sync = document.getElementById("sync-status");
        if (sync) sync.innerText = "Live";

    } catch (e) {
    } catch (err) {

        console.error(e);
        logEvent("NETWORK ERROR", "error");

        const syncLabel = document.getElementById('sync-status');
        if (syncLabel) {
            syncLabel.innerText = "Offline";
            syncLabel.style.color = "#ef4444";
        }

        logEvent("NETWORK ERROR: " + e.message, "error");
        const sync = document.getElementById("sync-status");
        if (sync) sync.innerText = "Offline";

} finally {
isFetching = false;
}
}

// ================= DASHBOARD =================
function updateDashboard(temp, vib, status, action) {
function updateDashboard(temp, vib, status) {

    const t = parseFloat(temp) || 0;
    const v = parseFloat(vib) || 0;

    document.getElementById("temp-val").innerText = t.toFixed(1);
    document.getElementById("vib-val").innerText = v.toFixed(3);

    const now = new Date().toLocaleTimeString();

    myChart.data.labels.push(now);
    myChart.data.datasets[0].data.push(t);
    myChart.data.datasets[1].data.push(v);

    if (myChart.data.labels.length > 20) {
        myChart.data.labels.shift();
        myChart.data.datasets.forEach(d => d.data.shift());
    }

    document.getElementById("temp-val").innerText = temp.toFixed(1);
    document.getElementById("vib-val").innerText = vib.toFixed(3);
    myChart.update('none');

    document.getElementById("status-label").innerText = action;
    document.getElementById("ai-action-step").innerText = action;
    document.getElementById("status-label").innerText = status;
}

// ================= UI =================
function toggleButtons(state) {
    document.getElementById("connect-btn").style.display = state ? "none" : "inline-block";
    document.getElementById("disconnect-btn").style.display = state ? "inline-block" : "none";
// ================= LOGGING =================
function logEvent(msg, type = "") {
    console.log(msg);
}

// ================= STOP =================
function stopMonitoring() {

isMonitoring = false;
    clearInterval(fetchInterval);

    if (fetchInterval) clearInterval(fetchInterval);

    updateDashboard(0, 0, "OFFLINE", "Stopped");
    logEvent("MONITORING STOPPED");

    toggleButtons(false);
    document.getElementById("status-label").innerText = "STOPPED";
}
