// State
let map;
let markers = {};
let currentMode = 'Passenger'; // Default

// Initialize Map
function initMap(center) {
    map = L.map('map', {
        zoomControl: false // Minimalist UI
    }).setView(center, 15);

    // Google Maps Tiles
    L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        attribution: 'Google',
        maxZoom: 20
    }).addTo(map);
}

// Custom Icons
const createIcon = (color, emoji) => L.divIcon({
    className: 'custom-marker',
    html: `<div style="background:${color}; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center;">${emoji}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
});

const icons = {
    'Passenger': createIcon('#3B82F6', '👤'),
    'Vacant': createIcon('#10B981', '🛺'),
    'On Ride': createIcon('#EF4444', '🛺'),
    'Me': createIcon('#000000', '📍')
};

// Fetch Data & Update Map
async function syncData() {
    try {
        // Animate Sync Button
        anime({
            targets: '#sync-fab i',
            rotate: '+=360',
            duration: 800,
            easing: 'easeInOutSine'
        });

        const res = await fetch('/api/data');
        const data = await res.json();
        
        if (!map) initMap(data.center);
        
        // Clear old markers (for simplicity in MVP, normally we'd update positions)
        Object.values(markers).forEach(m => map.removeLayer(m));
        markers = {};

        // Draw My Location
        markers['me'] = L.marker(data.center, {icon: icons['Me']}).addTo(map);

        // Draw Passengers
        data.passengers.forEach(p => {
            const m = L.marker([p.lat, p.lon], {icon: icons['Passenger']}).addTo(map);
            m.on('click', () => showBottomSheet('Passenger', p));
            markers[p.id] = m;
        });

        // Draw Autos
        data.autos.forEach(a => {
            const m = L.marker([a.lat, a.lon], {icon: icons[a.status]}).addTo(map);
            m.on('click', () => showBottomSheet('Auto', a));
            markers[a.id] = m;
        });

        // Entrance Animation for Map Markers (Anime.js)
        setTimeout(() => {
            const markerEls = document.querySelectorAll('.custom-marker div');
            anime({
                targets: markerEls,
                scale: [0, 1],
                opacity: [0, 1],
                delay: anime.stagger(20),
                duration: 600,
                easing: 'easeOutElastic(1, .5)'
            });
        }, 100);

    } catch (e) {
        console.error("Failed to sync data", e);
    }
}

// Bottom Sheet / Overlay Logic
let sheetVisible = false;
function showBottomSheet(type, data) {
    const sheetTitle = document.getElementById('sheet-title');
    const sheetDesc = document.getElementById('sheet-desc');
    const actBtns = document.getElementById('action-buttons');
    const callBtn = document.getElementById('call-btn');

    if (type === 'Auto') {
        sheetTitle.innerHTML = `Auto ${data.id} <span style="font-size:12px; color:${data.status==='Vacant'?'#10B981':'#EF4444'}">• ${data.status}</span>`;
        sheetDesc.innerHTML = `<b>Driver:</b> ${data.driver} <br> <b>Rating:</b> ⭐ ${data.rating}`;
        if (data.status === 'Vacant') {
            callBtn.innerHTML = `<i class="fas fa-phone"></i> Call ${data.phone}`;
            actBtns.style.display = 'block';
        } else {
            actBtns.style.display = 'none';
        }
    } else {
        sheetTitle.innerText = `Passenger ${data.id}`;
        sheetDesc.innerText = data.status;
        actBtns.style.display = 'none';
    }

    // Anime.js Bottom Sheet Slide Up
    anime({
        targets: '#bottom-sheet',
        translateY: ['100%', '0%'],
        duration: 400,
        easing: 'easeOutExpo'
    });
    sheetVisible = true;
}

// Hide sheet if map clicked
document.getElementById('map').addEventListener('click', () => {
    if (sheetVisible) {
        anime({
            targets: '#bottom-sheet',
            translateY: '100%',
            duration: 300,
            easing: 'easeInSine'
        });
        sheetVisible = false;
    }
});

// Interactive Button Clicks (Anime.js)
document.querySelectorAll('.interactive-btn').forEach(btn => {
    btn.addEventListener('touchstart', () => {
        anime({ targets: btn, scale: 0.95, duration: 100, easing: 'easeOutQuad' });
    });
    btn.addEventListener('touchend', () => {
        anime({ targets: btn, scale: 1, duration: 200, easing: 'easeOutElastic(1, .5)' });
    });
    // For Desktop testing
    btn.addEventListener('mousedown', () => {
        anime({ targets: btn, scale: 0.95, duration: 100, easing: 'easeOutQuad' });
    });
    btn.addEventListener('mouseup', () => {
        anime({ targets: btn, scale: 1, duration: 200, easing: 'easeOutElastic(1, .5)' });
    });
});

// Tab Navigation Logic with Animations
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function() {
        // Reset active state
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        this.classList.add('active');

        const targetId = this.getAttribute('data-target');
        
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.style.display = 'none';
            tab.classList.remove('active');
        });

        // Show targets with Anime.js Fade/Slide
        const newTab = document.getElementById(targetId);
        newTab.style.display = 'block';
        newTab.classList.add('active');

        anime({
            targets: newTab,
            opacity: [0, 1],
            translateY: [10, 0],
            duration: 400,
            easing: 'easeOutQuart'
        });

        // Trigger map resize issue fix due to display:none
        if (targetId === 'tab-map' && map) {
            setTimeout(() => map.invalidateSize(), 100);
        }
    });
});

// Initialize
document.getElementById('sync-fab').addEventListener('click', syncData);

// Initially load map
syncData();

// Poll every 5s for tracking
setInterval(syncData, 5000);
