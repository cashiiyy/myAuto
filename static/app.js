// State
let map;
let markers = {};
let currentMode = 'Passenger'; // Default
let myRealLocation = [12.9716, 77.5946];
let watchId = null;

// Initialize Map
function initMap(center) {
    if (map) return;
    map = L.map('map', {zoomControl: false}).setView(center, 15);
    L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        attribution: 'Google', maxZoom: 20
    }).addTo(map);
}

// Custom Icons
const createIcon = (color, emoji) => L.divIcon({
    className: 'custom-marker',
    html: `<div style="background:${color}; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center;">${emoji}</div>`,
    iconSize: [32, 32], iconAnchor: [16, 16]
});

const icons = {
    'Vacant': createIcon('#10B981', '🛺'),
    'On Ride': createIcon('#EF4444', '🛺'),
    'Booked': createIcon('#F59E0B', '🚨'),
    'Me': createIcon('#000000', '📍')
};

// Real GPS Tracking Initialization
function startRealGPSTracking() {
    if ("geolocation" in navigator) {
        watchId = navigator.geolocation.watchPosition((position) => {
            myRealLocation = [position.coords.latitude, position.coords.longitude];
            if (map && markers['me']) {
                markers['me'].setLatLng(myRealLocation);
                map.panTo(myRealLocation);
            }
        }, (error) => {
            console.warn("GPS Access Denied or Unavailable. Using Mock location.");
        }, { enableHighAccuracy: true });
    }
}

// Fetch Data & Update Map
async function syncData() {
    try {
        anime({targets: '#sync-fab i', rotate: '+=360', duration: 800, easing: 'easeInOutSine'});

        const res = await fetch('/api/data');
        const data = await res.json();
        
        if (!map) initMap(myRealLocation);
        
        Object.values(markers).forEach(m => {
            if (m !== markers['me']) map.removeLayer(m);
        });
        
        // Ensure my marker exists
        if (!markers['me']) {
            markers['me'] = L.marker(myRealLocation, {icon: icons['Me']}).addTo(map);
        }

        let amIBooked = false;

        // Draw Autos (Passengers removed as requested)
        data.autos.forEach(a => {
            // Check if I am the driver and I got booked
            if (currentMode === 'Driver' && a.id === 'MY-AUTO' && a.status === 'Booked') {
                amIBooked = true;
            }

            // Only plot if keeping simple. Don't show non-vacant for customers
            if (currentMode === 'Passenger' && a.status !== 'Vacant') return; // Hide non-vacants
            
            // Draw driver auto
            const m = L.marker([a.lat, a.lon], {icon: icons[a.status] || icons['Vacant']}).addTo(map);
            m.on('click', () => {
                if (currentMode === 'Passenger' && a.status === 'Vacant') {
                    showBottomSheet('Auto', a);
                }
            });
            markers[a.id] = m;
        });

        // Driver Notification Overlay
        const driverAlert = document.getElementById('driver-alert');
        if (amIBooked && driverAlert.classList.contains('hidden')) {
            driverAlert.classList.remove('hidden');
            anime({
                targets: '.alert-content',
                scale: [0.8, 1],
                opacity: [0, 1],
                duration: 500,
                easing: 'easeOutElastic(1, .5)'
            });
        }

    } catch (e) { console.error("Sync Failed", e); }
}

// Bottom Sheet / Booking Logic
let sheetVisible = false;
let selectedAutoId = null;

function showBottomSheet(type, data) {
    const sheetTitle = document.getElementById('sheet-title');
    const sheetDesc = document.getElementById('sheet-desc');
    const actBtns = document.getElementById('action-buttons');
    const callBtn = document.getElementById('call-btn');

    selectedAutoId = data.id;
    sheetTitle.innerHTML = `Auto ${data.id} <span style="font-size:12px; color:#10B981">• ${data.status}</span>`;
    sheetDesc.innerHTML = `<b>Driver:</b> ${data.driver} <br> <b>Rating:</b> ⭐ ${data.rating}`;
    
    // Setup Call Link
    callBtn.href = `tel:${data.phone.replace(/\s+/g, '')}`;
    actBtns.style.display = 'block';

    anime({targets: '#bottom-sheet', translateY: ['120%', '0%'], duration: 400, easing: 'easeOutExpo'});
    sheetVisible = true;
}

// Book Now Action
document.getElementById('book-btn').addEventListener('click', async () => {
    if (!selectedAutoId) return;
    try {
        await fetch('/api/book', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({auto_id: selectedAutoId, user_lat: myRealLocation[0], user_lon: myRealLocation[1]})
        });
        alert("Booking Confirmed! The driver has been notified.");
        
        anime({targets: '#bottom-sheet', translateY: '120%', duration: 300, easing: 'easeInSine'});
        sheetVisible = false;
        syncData(); // Refresh immediately to hide the auto
    } catch (e) { alert("Failed to book."); }
});

// Acknowledge Booking (Driver)
document.getElementById('accept-booking-btn').addEventListener('click', async () => {
    await fetch('/api/toggle?status=On Ride', {method: 'POST'});
    document.getElementById('driver-alert').classList.add('hidden');
    syncData();
});

// Hide sheet if map clicked
document.getElementById('map').addEventListener('click', () => {
    if (sheetVisible) {
        anime({targets: '#bottom-sheet', translateY: '120%', duration: 300, easing: 'easeInSine'});
        sheetVisible = false;
    }
});

// Full Screen Activity Modal Interactions
document.querySelectorAll('.activity-entry').forEach(entry => {
    entry.addEventListener('click', () => {
        const modal = document.getElementById('activity-modal');
        modal.style.display = 'block';
        anime({
            targets: modal,
            opacity: [0, 1],
            scale: [0.95, 1],
            duration: 300,
            easing: 'easeOutQuart'
        });
    });
});

document.getElementById('close-modal').addEventListener('click', () => {
    const modal = document.getElementById('activity-modal');
    anime({
        targets: modal,
        opacity: 0,
        scale: 0.95,
        duration: 250,
        easing: 'easeInQuart',
        complete: () => { modal.style.display = 'none'; }
    });
});

// Role Toggle Button
document.getElementById('driver-toggle-btn').addEventListener('click', () => {
    currentMode = currentMode === 'Passenger' ? 'Driver' : 'Passenger';
    document.getElementById('mode-text').innerText = currentMode + " Mode";
    alert("Switched to " + currentMode + " Mode.");
    syncData();
});

// Interactive Button Animations
document.querySelectorAll('.interactive-btn').forEach(btn => {
    btn.addEventListener('touchstart', () => anime({targets: btn, scale: 0.95, duration: 100}));
    btn.addEventListener('touchend', () => anime({targets: btn, scale: 1, duration: 200}));
    btn.addEventListener('mousedown', () => anime({targets: btn, scale: 0.95, duration: 100}));
    btn.addEventListener('mouseup', () => anime({targets: btn, scale: 1, duration: 200}));
});

// Tabs Logic
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function() {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        this.classList.add('active');

        const targetId = this.getAttribute('data-target');
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.style.display = 'none';
            tab.classList.remove('active');
        });

        const newTab = document.getElementById(targetId);
        newTab.style.display = 'block';
        newTab.classList.add('active');

        anime({targets: newTab, opacity: [0, 1], translateY: [10, 0], duration: 400});

        if (targetId === 'tab-map' && map) setTimeout(() => map.invalidateSize(), 100);
    });
});

// --- Auth & Splash Logic ---
let authMethod = '';

function startApp() {
    // Check if logged in
    const storedRole = localStorage.getItem('myAuto_role');
    if (storedRole) {
        currentMode = storedRole;
        document.getElementById('mode-text').innerText = currentMode + " Mode";
        document.getElementById('main-app').style.display = 'block';
        if(map) map.invalidateSize();
        startRealGPSTracking();
        syncData();
    } else {
        // Show Auth Screen
        document.getElementById('auth-screen').style.display = 'flex';
    }
}

// Splash Screen Entrance
window.addEventListener('load', () => {
    anime.timeline({
        complete: () => {
            document.getElementById('splash-screen').style.display = 'none';
            startApp();
        }
    })
    .add({ targets: '#splash-logo', scale: [0, 1.2], opacity: [0, 1], duration: 800, easing: 'easeOutElastic(1, .5)' })
    .add({ targets: '#splash-text', translateY: [20, 0], opacity: [0, 1], duration: 400, offset: '-=400' })
    .add({ targets: '#splash-screen', opacity: [1, 0], duration: 500, delay: 1000, easing: 'easeInOutQuad' });
});

// Auth Role Selection
document.querySelectorAll('.role-select-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.role-select-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        e.target.style.background = '#000';
        e.target.style.color = '#fff';
        document.querySelectorAll('.role-select-btn:not(.active)').forEach(b => {
             b.style.background = '#f0f0f0';
             b.style.color = '#333';
        });
    });
});

function triggerSignup(method) {
    if(method === 'google') {
        processAuthLogin(method, "Google User");
    } else {
        openAuthModal(method);
    }
}

function openAuthModal(method) {
    authMethod = method;
    const modal = document.getElementById('auth-input-modal');
    document.getElementById('auth-input-label').innerText = method === 'email' ? 'Enter Email Address' : 'Enter Phone Number';
    document.getElementById('auth-contact-input').placeholder = method === 'email' ? 'name@example.com' : '+91 99999 99999';
    modal.style.display = 'block';
    anime({ targets: modal, opacity: [0, 1], translateY: [10, 0], duration: 300, easing: 'easeOutQuad' });
}

async function submitAuth() {
    const contact = document.getElementById('auth-contact-input').value;
    if(!contact) return alert("Please enter your details");
    await processAuthLogin(authMethod, contact);
}

async function processAuthLogin(method, contact) {
    const role = document.querySelector('.role-select-btn.active').getAttribute('data-role');
    try {
        const res = await fetch('/api/signup', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({method, contact, role})
        });
        const data = await res.json();
        
        if (data.status === 'success') {
            localStorage.setItem('myAuto_role', role);
            document.getElementById('auth-screen').style.display = 'none';
            startApp();
        }
    } catch(e) { alert("Auth failed. Server running?"); }
}

// --- Profile Modals Logic ---
document.querySelectorAll('.profile-entry').forEach(entry => {
    entry.addEventListener('click', () => {
        const targetId = entry.getAttribute('data-target');
        const modal = document.getElementById(targetId);
        modal.style.display = 'block';
        anime({ targets: modal, opacity: [0, 1], scale: [0.95, 1], duration: 300, easing: 'easeOutQuart' });
    });
});
document.querySelectorAll('.close-profile-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.full-screen-modal');
        anime({
            targets: modal, opacity: 0, scale: 0.95, duration: 250, easing: 'easeInQuart',
            complete: () => { modal.style.display = 'none'; }
        });
    });
});

// Initialize Polling
setInterval(() => {
    if (document.getElementById('main-app').style.display === 'block') {
         syncData();
    }
}, 5000);


