const GAS_URL = "https://script.google.com/macros/s/AKfycbzxW6ws7_0IXkqLIeXO6DVeJGnnKudpSJyZUYk4-Nt2yvR16gtCzpK__0gfCqWfxTke/exec";

const MAX_POINTS = 40;
const HORIZON_MIN = 3;


const DATA_TIMEOUT_MIN = 5;

let tempReal, tempPred, vibReal, vibPred;

window.onload = () => {

    tempReal = createChart("tempRealChart", "Temp Real", "#ef4444");
    tempPred = createChart("tempPredChart", "Temp Pred", "#f59e0b");

    vibReal  = createChart("vibRealChart", "Vib Real", "#10b981");
    vibPred  = createChart("vibPredChart", "Vib Pred", "#3b82f6");

    fetchData();

    setInterval(fetchData, 3000);
};

async function fetchData() {

    try {

        const res = await fetch(GAS_URL + "?read=true");
        const d = await res.json();

        // =========================
        // CHECK DATA FRESHNESS
        // =========================
        const dataTime = new Date(d.timestamp);
        const now = new Date();

        const ageMinutes =
            (now.getTime() - dataTime.getTime()) / 60000;

        // if stale -> reset dashboard
        if (isNaN(ageMinutes) || ageMinutes > DATA_TIMEOUT_MIN) {

            resetDashboard();

            setLog("No recent FPGA data.");

            return;
        }

        updateUI(d);

    } catch {

        resetDashboard();

        setLog("FPGA disconnected.");
    }
}

function resetDashboard() {

    set("temp", "0.00°C");
    set("vib", "0.000 G");

    set("predTemp", "0.00°C");
    set("predVib", "0.000 G");

    const badge = document.getElementById("system-status");

    badge.className = "badge normal";
    badge.innerText = "OFFLINE";

    renderAlert(
        "tempAlert",
        "tempWarningText",
        "tempReco",
        "N",
        "TEMPERATURE"
    );

    renderAlert(
        "vibAlert",
        "vibWarningText",
        "vibReco",
        "N",
        "VIBRATION"
    );
}

function updateUI(d) {

    const temp = Number(d.temp ?? 0);
    const vib  = Number(d.vibration ?? 0);

    const predTemp = Number(d.predTemp ?? 0);
    const predVib  = Number(d.predVib ?? 0);

    const tStatus = (d.tempStatus ?? "N").trim();
    const vStatus = (d.vibStatus ?? "N").trim();

    set("temp", temp.toFixed(2) + "°C");
    set("vib", vib.toFixed(3) + " G");

    set("predTemp", predTemp.toFixed(2) + "°C");
    set("predVib", predVib.toFixed(3) + " G");

    // =========================
    // GLOBAL STATUS
    // =========================
    let system =
        (tStatus === "T" || vStatus === "B") ? "critical" :
        (tStatus === "W" || vStatus === "W") ? "warning" :
        "normal";

    const badge = document.getElementById("system-status");

    badge.className = "badge " + system;
    badge.innerText = system.toUpperCase();

    // =========================
    // TEMP ALERT
    // =========================
    renderAlert(
        "tempAlert",
        "tempWarningText",
        "tempReco",
        tStatus,
        "TEMPERATURE"
    );

    // =========================
    // VIB ALERT
    // =========================
    renderAlert(
        "vibAlert",
        "vibWarningText",
        "vibReco",
        vStatus,
        "VIBRATION"
    );

    const now = new Date();

    const realTime =
        now.toLocaleTimeString();

    const predTime =
        new Date(
            now.getTime() + HORIZON_MIN * 60000
        ).toLocaleTimeString();

    // =========================
    // PUSH REAL DATA
    // =========================
    push(tempReal, realTime, temp);
    push(vibReal, realTime, vib);

    // =========================
    // PUSH PREDICTED DATA
    // =========================
    push(tempPred, predTime, predTemp);
    push(vibPred, predTime, predVib);

    setLog("FPGA predictive maintenance active.");
}

/* =========================
   ALERT ENGINE
========================= */
function renderAlert(boxId, textId, recoId, status, type) {

    const box = document.getElementById(boxId);

    let state = "NORMAL";
    let reco = "No maintenance required.";

    if (status === "W") {

        state = "WARNING";

        reco =
            `Monitor ${type.toLowerCase()} trend. Schedule inspection.`;

        box.className = "alert-box warning";
    }
    else if (status === "T" || status === "B") {

        state = "CRITICAL";

        reco =
            `Immediate maintenance required for ${type.toLowerCase()}.`;

        box.className = "alert-box critical";
    }
    else {

        box.className = "alert-box normal";
    }

    document.getElementById(textId).innerText = state;
    document.getElementById(recoId).innerText = reco;
}

/* =========================
   CHART
========================= */
function createChart(id, label, color) {

    return new Chart(document.getElementById(id), {

        type: "line",

        data: {
            labels: [],
            datasets: [{
                label: label,
                data: [],
                borderColor: color,
                backgroundColor: color,
                borderWidth: 2,
                pointRadius: 2,
                fill: false,
                tension: 0.35
            }]
        },

        options: {

            responsive: true,

            animation: {
                duration: 300
            },

            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function push(chart, label, value) {

    if (isNaN(value)) return;

    chart.data.labels.push(label);
    chart.data.datasets[0].data.push(value);

    if (chart.data.labels.length > MAX_POINTS) {

        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
    }

    chart.update();
}

function set(id, v) {
    document.getElementById(id).innerText = v;
}

function setLog(msg) {
    document.getElementById("logText").innerText = msg;
}