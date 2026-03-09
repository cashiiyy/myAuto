// State
let map;
let markers = {};
let currentMode = 'Passenger'; // Default
let myRealLocation = [12.9716, 77.5946];
let watchId = null;
let safetyContacts = [];
let deleteTargetIdx = null;

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

        // Draw Autos
        data.autos.forEach(a => {
            if (currentMode === 'Driver' && a.id === 'MY-AUTO' && a.status === 'Booked') {
                amIBooked = true;
            }
            if (currentMode === 'Passenger' && a.status !== 'Vacant') return;
            
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
        syncData();
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

// Full Screen Activity Modal
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

// ==============================
// RECENTER MAP BUTTON
// ==============================
document.getElementById('recenter-fab').addEventListener('click', () => {
    if (map) {
        map.setView(myRealLocation, 15, { animate: true });
        if (markers['me']) markers['me'].setLatLng(myRealLocation);
        anime({targets: '#recenter-fab i', rotate: '+=360', duration: 600, easing: 'easeInOutSine'});
    }
});

// ==============================
// SYNC FAB
// ==============================
document.getElementById('sync-fab').addEventListener('click', () => { syncData(); });

// ==============================
// SIGN OUT
// ==============================
document.getElementById('sign-out-btn').addEventListener('click', () => {
    if (confirm('Are you sure you want to sign out?')) {
        localStorage.removeItem('myAuto_role');
        localStorage.removeItem('myAuto_name');
        localStorage.removeItem('myAuto_email');
        localStorage.removeItem('myAuto_profilePic');
        localStorage.removeItem('myAuto_safetyContacts');
        localStorage.removeItem('myAuto_theme');
        location.reload();
    }
});

// ==============================
// SORT & FILTER (Activity)
// ==============================
document.getElementById('sort-filter-btn').addEventListener('click', () => {
    const dropdown = document.getElementById('sort-filter-dropdown');
    const isVisible = dropdown.style.display !== 'none';
    if (isVisible) {
        anime({ targets: dropdown, opacity: [1, 0], translateY: [0, -10], duration: 200, easing: 'easeInQuad', complete: () => dropdown.style.display = 'none' });
    } else {
        dropdown.style.display = 'block';
        anime({ targets: dropdown, opacity: [0, 1], translateY: [-10, 0], duration: 250, easing: 'easeOutQuad' });
    }
});

document.querySelectorAll('.sort-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        document.querySelectorAll('.sort-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        applySortFilter();
    });
});

document.querySelectorAll('.order-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        document.querySelectorAll('.order-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        applySortFilter();
    });
});

function applySortFilter() {
    const sortBy = document.querySelector('.sort-chip.active').dataset.sort;
    const order = document.querySelector('.order-chip.active').dataset.order;
    const list = document.getElementById('activity-list');
    const entries = Array.from(list.querySelectorAll('.activity-entry'));
    
    entries.sort((a, b) => {
        let valA, valB;
        if (sortBy === 'time') {
            valA = new Date(a.dataset.time).getTime();
            valB = new Date(b.dataset.time).getTime();
        } else if (sortBy === 'distance') {
            valA = parseFloat(a.dataset.distance);
            valB = parseFloat(b.dataset.distance);
        } else if (sortBy === 'rate') {
            valA = parseFloat(a.dataset.rate);
            valB = parseFloat(b.dataset.rate);
        }
        return order === 'asc' ? valA - valB : valB - valA;
    });
    
    entries.forEach(e => list.appendChild(e));
    
    // Re-animate
    anime({ targets: '.activity-entry', opacity: [0, 1], translateX: [-20, 0], delay: anime.stagger(80), duration: 300, easing: 'easeOutQuad' });
}

// ==============================
// AUTH & SPLASH
// ==============================
let authMethod = '';

function startApp() {
    const storedRole = localStorage.getItem('myAuto_role');
    if (storedRole) {
        currentMode = storedRole;
        document.getElementById('mode-text').innerText = currentMode + " Mode";
        document.getElementById('main-app').style.display = 'block';
        
        // Restore profile name
        const storedName = localStorage.getItem('myAuto_name');
        if (storedName) {
            document.getElementById('profile-display-name').innerText = storedName;
            document.getElementById('personal-name-input').value = storedName;
        }
        
        // Restore profile picture
        const storedPic = localStorage.getItem('myAuto_profilePic');
        if (storedPic) {
            applyProfilePicture(storedPic);
        }
        
        // Restore safety contacts
        const storedContacts = localStorage.getItem('myAuto_safetyContacts');
        if (storedContacts) {
            safetyContacts = JSON.parse(storedContacts);
            renderSafetyContacts();
        }
        
        // Restore theme
        const storedTheme = localStorage.getItem('myAuto_theme');
        if (storedTheme === 'dark') {
            document.body.classList.add('dark-mode');
            document.getElementById('theme-icon').classList.replace('fa-moon', 'fa-sun');
        }
        
        if(map) map.invalidateSize();
        startRealGPSTracking();
        syncData();
    } else {
        document.getElementById('auth-screen').style.display = 'flex';
    }
}

// Splash Screen
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

// ==============================
// PROFILE: SAVE NAME & PICTURE
// ==============================
document.getElementById('save-personal-btn').addEventListener('click', () => {
    const name = document.getElementById('personal-name-input').value.trim();
    const email = document.getElementById('personal-email-input').value.trim();
    
    if (name) {
        localStorage.setItem('myAuto_name', name);
        document.getElementById('profile-display-name').innerText = name;
    }
    if (email) {
        localStorage.setItem('myAuto_email', email);
    }
    
    // Close modal with feedback
    const modal = document.getElementById('modal-personal');
    anime({
        targets: modal, opacity: 0, scale: 0.95, duration: 250, easing: 'easeInQuart',
        complete: () => { modal.style.display = 'none'; }
    });
    
    // Quick toast feedback
    showToast('Details saved successfully!');
});

// Profile Picture Upload
document.getElementById('profile-pic-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(event) {
        const base64 = event.target.result;
        localStorage.setItem('myAuto_profilePic', base64);
        applyProfilePicture(base64);
        showToast('Profile picture updated!');
    };
    reader.readAsDataURL(file);
});

function applyProfilePicture(base64) {
    // Personal Details preview
    const personalImg = document.getElementById('personal-avatar-img');
    personalImg.src = base64;
    personalImg.style.display = 'block';
    document.getElementById('personal-avatar-placeholder').style.display = 'none';
    
    // Profile tab avatar
    const profileImg = document.getElementById('profile-avatar-img');
    profileImg.src = base64;
    profileImg.style.display = 'block';
    document.getElementById('profile-avatar-icon').style.display = 'none';
}

// Toast notification
function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.textContent = msg;
    document.body.appendChild(toast);
    anime({
        targets: toast,
        opacity: [0, 1], translateY: [20, 0],
        duration: 300, easing: 'easeOutQuad',
        complete: () => {
            setTimeout(() => {
                anime({
                    targets: toast, opacity: 0, translateY: -20, duration: 300,
                    complete: () => toast.remove()
                });
            }, 2000);
        }
    });
}

// ==============================
// SAFETY CONTACTS CRUD
// ==============================
document.getElementById('save-safety-contact-btn').addEventListener('click', () => {
    const name = document.getElementById('safety-name-input').value.trim();
    const relation = document.getElementById('safety-relation-input').value.trim();
    const phone = document.getElementById('safety-phone-input').value.trim();
    const note = document.getElementById('safety-note-input').value.trim();
    
    if (!name || !phone) {
        return alert('Please enter at least a name and phone number.');
    }
    
    safetyContacts.push({ name, relation, phone, note });
    localStorage.setItem('myAuto_safetyContacts', JSON.stringify(safetyContacts));
    
    // Clear inputs
    document.getElementById('safety-name-input').value = '';
    document.getElementById('safety-relation-input').value = '';
    document.getElementById('safety-phone-input').value = '';
    document.getElementById('safety-note-input').value = '';
    
    renderSafetyContacts();
    showToast('Contact saved!');
});

function renderSafetyContacts() {
    const list = document.getElementById('safety-contacts-list');
    list.innerHTML = '';
    
    safetyContacts.forEach((c, idx) => {
        const div = document.createElement('div');
        div.style.cssText = 'background:#f9f9f9; padding:15px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;';
        div.innerHTML = `
            <div>
                <strong>${c.name}</strong> ${c.relation ? `<span style="color:#999; font-size:12px;">(${c.relation})</span>` : ''}
                <br><span style="color:#666; font-size:12px;">${c.phone}</span>
                ${c.note ? `<br><span style="color:#999; font-size:11px; font-style:italic;">${c.note}</span>` : ''}
            </div>
            <button class="icon-btn delete-contact-btn" data-idx="${idx}" style="color:#EF4444; font-size:18px; padding:8px;">
                <i class="fas fa-trash"></i>
            </button>
        `;
        list.appendChild(div);
        
        // Animate in
        anime({ targets: div, opacity: [0, 1], translateX: [-20, 0], duration: 300, delay: idx * 50, easing: 'easeOutQuad' });
    });
    
    // Attach delete handlers
    document.querySelectorAll('.delete-contact-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.idx);
            deleteTargetIdx = idx;
            document.getElementById('delete-confirm-text').innerText = 
                `Are you sure you want to delete "${safetyContacts[idx].name}" from your safety contacts?`;
            const modal = document.getElementById('delete-confirm-modal');
            modal.style.display = 'flex';
            anime({ targets: '.delete-confirm-box', scale: [0.8, 1], opacity: [0, 1], duration: 300, easing: 'easeOutQuart' });
        });
    });
}

// Delete Confirmation
document.getElementById('delete-cancel-btn').addEventListener('click', () => {
    const modal = document.getElementById('delete-confirm-modal');
    anime({ targets: '.delete-confirm-box', scale: 0.8, opacity: 0, duration: 200, easing: 'easeInQuart', complete: () => modal.style.display = 'none' });
    deleteTargetIdx = null;
});

document.getElementById('delete-confirm-btn').addEventListener('click', () => {
    if (deleteTargetIdx !== null) {
        safetyContacts.splice(deleteTargetIdx, 1);
        localStorage.setItem('myAuto_safetyContacts', JSON.stringify(safetyContacts));
        renderSafetyContacts();
        showToast('Contact deleted.');
    }
    const modal = document.getElementById('delete-confirm-modal');
    anime({ targets: '.delete-confirm-box', scale: 0.8, opacity: 0, duration: 200, easing: 'easeInQuart', complete: () => modal.style.display = 'none' });
    deleteTargetIdx = null;
});

// ==============================
// DARK / LIGHT MODE
// ==============================
document.getElementById('theme-toggle-btn').addEventListener('click', () => {
    const body = document.body;
    const icon = document.getElementById('theme-icon');
    body.classList.toggle('dark-mode');
    
    if (body.classList.contains('dark-mode')) {
        icon.classList.replace('fa-moon', 'fa-sun');
        localStorage.setItem('myAuto_theme', 'dark');
    } else {
        icon.classList.replace('fa-sun', 'fa-moon');
        localStorage.setItem('myAuto_theme', 'light');
    }
    
    anime({ targets: '#theme-toggle-btn', rotate: '+=360', duration: 500, easing: 'easeInOutSine' });
});

// ==============================
// PROFILE MODALS
// ==============================
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
