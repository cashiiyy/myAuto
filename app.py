import streamlit as st
import pandas as pd
import folium
from streamlit_folium import st_folium
import numpy as np
import uuid

# Set up the page with a clean, wide layout
st.set_page_config(layout="wide", page_title="Auto-Tracking & Shared Ride MVP", initial_sidebar_state="collapsed")

# --- Premium UI/UX CSS Styling ---
st.markdown("""
<style>
    /* Global Background and Typography */
    .stApp {
        background-color: #f8f9fa;
        font-family: 'Inter', 'Roboto', sans-serif;
    }
    
    /* Header Hiding for App Feel */
    header {visibility: hidden;}
    
    /* Card Styling */
    .stCard {
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
        padding: 20px;
        margin-bottom: 20px;
    }

    /* Primary Uber-like Buttons (Black/Dark) */
    .stButton>button {
        background-color: #000000;
        color: white;
        border-radius: 8px;
        border: none;
        padding: 12px 24px;
        font-weight: 600;
        transition: all 0.2s;
        width: 100%;
        font-size: 16px;
    }
    .stButton>button:hover {
        background-color: #333333;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        transform: translateY(-1px);
    }

    /* SOS Button overriding primary */
    div[data-testid="stVerticalBlock"] div:has(button:contains("SOS")) .stButton>button {
        background-color: #E22A2A; /* Bright red */
    }
    div[data-testid="stVerticalBlock"] div:has(button:contains("SOS")) .stButton>button:hover {
         background-color: #C12323;
    }

    /* Map Container Polish */
    iframe {
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        border: 2px solid #eaeaea;
    }

    /* Titles and text */
    h1, h2, h3 {
        color: #111111;
        font-weight: 700;
        letter-spacing: -0.5px;
    }
    .status-badge {
        display: inline-block;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: bold;
    }
    .vacant-badge { background-color: #E8F5E9; color: #2E7D32; }
    .ride-badge { background-color: #FFEBEE; color: #C62828; }
</style>
""", unsafe_allow_html=True)

# --- State Management (Simulating a DB) ---
if 'db_initialized' not in st.session_state:
    st.session_state.my_location = [12.9716, 77.5946] # Base city coords
    
    # Generate Mock Passengers
    num_passengers = 15
    pass_lats = st.session_state.my_location[0] + np.random.normal(0, 0.02, num_passengers)
    pass_lons = st.session_state.my_location[1] + np.random.normal(0, 0.02, num_passengers)
    
    st.session_state.passengers = pd.DataFrame({
        'id': [str(uuid.uuid4())[:8] for _ in range(num_passengers)],
        'lat': pass_lats,
        'lon': pass_lons,
        'status': 'Looking for ride'
    })

    # Generate Mock Autos
    num_autos = 20
    auto_lats = st.session_state.my_location[0] + np.random.normal(0, 0.02, num_autos)
    auto_lons = st.session_state.my_location[1] + np.random.normal(0, 0.02, num_autos)
    status_choices = ['Vacant', 'On Ride']
    
    st.session_state.autos = pd.DataFrame({
        'id': [f"KA-{np.random.randint(10,99)}-{np.random.randint(1000,9999)}" for _ in range(num_autos)],
        'lat': auto_lats,
        'lon': auto_lons,
        'status': np.random.choice(status_choices, num_autos, p=[0.6, 0.4]),
        'driver': [f"Driver {i}" for i in range(num_autos)],
        'phone': [f"+91 99999 {np.random.randint(10000, 99999)}" for _ in range(num_autos)],
        'rating': np.round(np.random.uniform(4.0, 5.0, num_autos), 1)
    })
    
    st.session_state.my_id = str(uuid.uuid4())[:8]
    st.session_state.db_initialized = True
    st.session_state.role = None 

# --- Helper: Simulate Live GPS Movement ---
def update_gps_locations():
    st.session_state.autos['lat'] += np.random.normal(0, 0.0005, len(st.session_state.autos))
    st.session_state.autos['lon'] += np.random.normal(0, 0.0005, len(st.session_state.autos))
    st.session_state.passengers['lat'] += np.random.normal(0, 0.0001, len(st.session_state.passengers))
    st.session_state.passengers['lon'] += np.random.normal(0, 0.0001, len(st.session_state.passengers))


# --- Login/Role Selection Screen ---
if st.session_state.role is None:
    st.markdown("<div style='text-align: center; margin-top: 50px;'><h1 style='font-size: 3em;'>Namma Auto 🛺</h1><p style='color: #666; font-size: 1.2em;'>Your city, your ride. Transparent tracking for everyone.</p></div>", unsafe_allow_html=True)
    st.write("---")
    
    col1, col2, col3, col4 = st.columns([1, 2, 2, 1])
    with col2:
        st.markdown("<div class='stCard'>", unsafe_allow_html=True)
        st.write("### 👤 For Passengers")
        st.write("Find nearby autos instantly. No surges, no hidden fees.")
        if st.button("Log in as Passenger"):
            st.session_state.role = 'Passenger'
            st.rerun()
        st.markdown("</div>", unsafe_allow_html=True)
            
    with col3:
        st.markdown("<div class='stCard'>", unsafe_allow_html=True)
        st.write("### 🛺 For Drivers")
        st.write("Broadcast availability automatically. Get direct pings.")
        if st.button("Log in as Driver"):
            st.session_state.role = 'Driver'
            my_auto = st.session_state.autos.iloc[0]
            st.session_state.autos.loc[0, 'id'] = "MY-AUTO"
            st.session_state.my_auto_idx = 0
            st.rerun()
        st.markdown("</div>", unsafe_allow_html=True)

    st.stop()


# --- Main Application Views ---

# Initialize Base Map
map_center = st.session_state.my_location
if st.session_state.role == 'Driver':
    map_center = [
        st.session_state.autos.loc[st.session_state.my_auto_idx, 'lat'],
        st.session_state.autos.loc[st.session_state.my_auto_idx, 'lon']
    ]

# Use a sleek, minimalist tileset similar to Uber's custom maps if possible, otherwise clean Google Maps
m = folium.Map(location=map_center, zoom_start=15, control_scale=False)
# Google Maps clean street layout (resembling premium apps)
google_tiles = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'
folium.TileLayer(tiles=google_tiles, attr='Google', name='Google Maps').add_to(m)


# Custom Icons for Premium Feel
def get_user_icon():
    return folium.DivIcon(html=f"""
        <div style="background-color:#000; border:2px solid white; width:16px; height:16px; border-radius:50%; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>
    """)

def get_auto_icon(status):
    color = "#10B981" if status == 'Vacant' else "#EF4444" # Modern Green / Red
    return folium.DivIcon(html=f"""
        <div style="
            background-color: {color}; 
            color: white;
            border: 2px solid white; 
            width: 32px; 
            height: 32px; 
            border-radius: 50%; 
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            font-size: 14px;
        ">🛺</div>
    """)

def get_other_user_icon():
    return folium.DivIcon(html=f"""
        <div style="background-color:#3B82F6; border:2px solid white; width:12px; height:12px; border-radius:50%; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>
    """)

# --- Sidebar / Overlay UI ---
with st.sidebar:
    st.markdown("### 🛺 Namma Auto")
    st.write(f"**Mode:** {st.session_state.role}")
    st.write("---")
    
    if st.session_state.role == 'Driver':
        my_status = st.session_state.autos.loc[st.session_state.my_auto_idx, 'status']
        st.write("#### Hardware Signal")
        new_status = st.radio(
            "Meter Status Simulator:",
            options=['Vacant', 'On Ride'],
            index=0 if my_status == 'Vacant' else 1
        )
        if new_status != my_status:
            st.session_state.autos.loc[st.session_state.my_auto_idx, 'status'] = new_status
            st.rerun()
        st.write("---")

    if st.button("📍 Sync Live Location"):
        update_gps_locations()
        st.rerun()
        
    st.write(" ")
    st.write(" ")
    if st.session_state.role == 'Passenger':
        if st.button("🚨 SOS"):
            st.error("Emergency Alert Sent.")
            
    st.write("---")
    if st.button("Log Out"):
         st.session_state.role = None
         st.rerun()


# --- Map Rendering Logic ---
st.markdown(f"<h2>Hello, {st.session_state.role}</h2>", unsafe_allow_html=True)
if st.session_state.role == 'Passenger':
    st.markdown("<p style='color: #666;'>Find a ride around you. Blue dots are other passengers.</p>", unsafe_allow_html=True)
    
    # 1. Plot My Location
    folium.Marker(st.session_state.my_location, popup="<b>You</b>", icon=get_user_icon()).add_to(m)
    
    # 2. Plot Other Passengers
    for _, p in st.session_state.passengers.iterrows():
        folium.Marker([p['lat'], p['lon']], popup="Other User", icon=get_other_user_icon()).add_to(m)
        
    # 3. Plot Autos
    for _, auto in st.session_state.autos.iterrows():
        badge_class = "vacant-badge" if auto['status'] == 'Vacant' else "ride-badge"
        popup_html = f"""
        <div style="font-family: Arial; padding: 5px;">
            <b style="font-size: 16px;">{auto['id']}</b><br>
            <span class="{badge_class}">{auto['status']}</span><br>
            <div style="margin-top: 8px;"><b>⭐ {auto['rating']}</b> | {auto['driver']}</div>
        """
        if auto['status'] == 'Vacant':
            popup_html += f"<div style='margin-top: 8px; font-weight: bold; background: #eee; padding: 5px; text-align:center;'>📞 {auto['phone']}</div>"
        popup_html += "</div>"
            
        folium.Marker(
            [auto['lat'], auto['lon']], 
            popup=folium.Popup(popup_html, max_width=300),
            icon=get_auto_icon(auto['status'])
        ).add_to(m)

elif st.session_state.role == 'Driver':
    st.markdown("<p style='color: #666;'>Broadcasting your location. Blue dots are passengers looking for rides.</p>", unsafe_allow_html=True)
    my_status = st.session_state.autos.loc[st.session_state.my_auto_idx, 'status']
    
    # 1. Plot My Auto
    folium.Marker(map_center, popup="<b>Your Auto</b>", icon=get_auto_icon(my_status)).add_to(m)
    
    # 2. Plot Passengers
    for _, p in st.session_state.passengers.iterrows():
        folium.Marker([p['lat'], p['lon']], popup="Finding Ride", icon=get_other_user_icon()).add_to(m)

# Render the Map taking up most of the screen width/height for a premium feel
st_folium(m, width=1400, height=650, returned_objects=[])

