from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import uuid
import random

app = FastAPI()

# --- Request Models ---
class SignupRequest(BaseModel):
    method: str
    contact: str
    role: str

class BookRequest(BaseModel):
    auto_id: str
    user_lat: float
    user_lon: float

# --- Mock Database ---
class MockDB:
    def __init__(self):
        self.base_loc = [12.9716, 77.5946] # Bangalore
        
        # Passengers
        num_pass = 15
        p_lats = [self.base_loc[0] + random.gauss(0, 0.02) for _ in range(num_pass)]
        p_lons = [self.base_loc[1] + random.gauss(0, 0.02) for _ in range(num_pass)]
        self.passengers = [{
            "id": str(uuid.uuid4())[:8],
            "lat": float(lat),
            "lon": float(lon),
            "status": "Looking for ride"
        } for lat, lon in zip(p_lats, p_lons)]
        
        # Autos
        num_autos = 20
        a_lats = [self.base_loc[0] + random.gauss(0, 0.02) for _ in range(num_autos)]
        a_lons = [self.base_loc[1] + random.gauss(0, 0.02) for _ in range(num_autos)]
        self.autos = [{
            "id": f"KA-{random.randint(10,99)}-{random.randint(1000,9999)}",
            "lat": float(lat),
            "lon": float(lon),
            "status": random.choice(["Vacant", "On Ride"]),
            "driver": f"Driver {i}",
            "phone": f"+91 99999 {random.randint(10000, 99999)}",
            "rating": round(random.uniform(4.0, 5.0), 1)
        } for i, (lat, lon) in enumerate(zip(a_lats, a_lons))]
        
        # Ensure my auto exists for testing
        self.autos[0]["id"] = "MY-AUTO"
        
    def step(self):
        # Simulate slight movement
        for p in self.passengers:
            p["lat"] += random.gauss(0, 0.0001)
            p["lon"] += random.gauss(0, 0.0001)
        for a in self.autos:
            a["lat"] += random.gauss(0, 0.0005)
            a["lon"] += random.gauss(0, 0.0005)

db = MockDB()

# --- API Endpoints ---
@app.get("/api/data")
def get_data():
    db.step() # Move them slightly each fetch
    return {
        "passengers": db.passengers,
        "autos": db.autos,
        "center": db.base_loc
    }

@app.post("/api/toggle")
def toggle_my_auto(status: str):
    db.autos[0]["status"] = status
    return {"status": "success", "new_status": status}

@app.post("/api/signup")
def signup(req: SignupRequest):
    print(f"[AUTH] {req.role} signup via {req.method}: {req.contact}")
    if req.method == "email":
        print(f"  → Sent Welcome Email to {req.contact}")
    elif req.method == "phone":
        print(f"  → Sent Welcome SMS to {req.contact}")
    else:
        print(f"  → Google OAuth for {req.contact}")
    return {"status": "success", "token": str(uuid.uuid4()), "role": req.role}

@app.post("/api/book")
def book_auto(req: BookRequest):
    for auto in db.autos:
        if auto["id"] == req.auto_id:
            auto["status"] = "Booked"
            print(f"[BOOKING] Auto {req.auto_id} booked by user at ({req.user_lat}, {req.user_lon})")
            return {"status": "success", "auto_id": req.auto_id}
    return {"status": "error", "message": "Auto not found"}

# Serve static files as the main application
app.mount("/static", StaticFiles(directory="k:/PROJECTS/auto/static"), name="static")

@app.get("/")
def read_index():
    return FileResponse("k:/PROJECTS/auto/static/index.html")

@app.get("/manifest.json")
def read_manifest():
    return FileResponse("k:/PROJECTS/auto/static/manifest.json")

@app.get("/sw.js")
def read_sw():
    return FileResponse("k:/PROJECTS/auto/static/sw.js")
