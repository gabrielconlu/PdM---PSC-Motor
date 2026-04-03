const url = "https://script.google.com/macros/s/AKfycbwSOu_RIydveUUzbOvDLDuId2BG14_qzjqTXPnK7gSKmYsdSYkJulYUza0aMWmjA1M/exec"; 

let myChart;
let fetchInterval;

window.onload = function() {
    initChart(); // Tawagin ang function para i-setup ang chart
};

async function startMonitoring() {
    document.getElementById('connect-btn').style.display = "none";
    document.getElementById('disconnect-btn').style.display = "inline-block";
    
    logEvent("SYSTEM START: Fetching data from Google Sheets...");

    // Simulan ang pagkuha ng data bawat 5 seconds
    fetchInterval = setInterval(fetchDataFromSheets, 5000);
}

async function fetchDataFromSheets() {
    try {
        document.getElementById('sync-status').innerText = "Fetching...";
        
        // Nagdadagdag tayo ng ?read=true para malaman ng Script na kailangan natin ng data
        const response = await fetch(`${url}?read=true`);
        const data = await response.json();

        if (data.temp) {
            updateDashboard(data.temp, data.vibration, data.status);
            document.getElementById('sync-status').innerText = "Live";
            document.getElementById('sync-status').style.color = "#00ff88";
        }
    } catch (e) {
        console.error("Fetch Error:", e);
        document.getElementById('sync-status').innerText = "Offline";
        document.getElementById('sync-status').style.color = "#ff4444";
    }
}

function updateDashboard(t, v, s) {
    // Update numerical displays
    document.getElementById('temp-display').innerText = t.toFixed(1) + "°C";
    document.getElementById('vib-display').innerText = v.toFixed(2) + "G";

    // Threshold & AI Logic
    const aiSug = document.getElementById('ai-suggestion');
    const aiAction = document.getElementById('ai-action-step');
    
    if (t >= 70 || v >= 3.0) {
        aiSug.innerText = "CRITICAL: " + s;
        aiSug.style.color = "#ff4444";
        aiAction.innerHTML = "⚠️ <b>HUMAN CHECK REQUIRED:</b> Check for burning smell or humming sounds!";
        logEvent(`ALERT: High values detected (${t}°C, ${v}G)`);
    } else {
        aiSug.innerText = "SYSTEM NORMAL";
        aiSug.style.color = "#00ff88";
        aiAction.innerText = "Continuous monitoring of PSC Motor...";
    }

    // Chart Update
    const now = new Date().toLocaleTimeString([], { hour12: false });
    myChart.data.labels.push(now);
    myChart.data.datasets[0].data.push(t);
    myChart.data.datasets[1].data.push(v);
    
    // Limit points sa chart para hindi bumagal (Last 20 points)
    if (myChart.data.labels.length > 20) {
        myChart.data.labels.shift();
        myChart.data.datasets.forEach(d => d.data.shift());
    }
    myChart.update('none');
}

function stopMonitoring() {
    clearInterval(fetchInterval);
    document.getElementById('connect-btn').style.display = "inline-block";
    document.getElementById('disconnect-btn').style.display = "none";
    logEvent("STOPPED: Polling paused.");
}

// ... (Panatilihin ang initChart, logEvent, at clearHistory functions)
