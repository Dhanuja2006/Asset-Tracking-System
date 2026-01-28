from flask import Flask, jsonify
import json
import psycopg2
from psycopg2 import pool
import paho.mqtt.client as mqtt
from datetime import datetime, timedelta
import pytz
import threading
import traceback

# ==========================================================
# DATABASE CONFIG
# ==========================================================
db_pool = psycopg2.pool.SimpleConnectionPool(
    1, 10,
    dbname="asset_tracking_db_test_3",
    user="postgres",
    password="#####",
    host="localhost",
    port="5432"
)

def get_db_connection():
    return db_pool.getconn()

def return_db_connection(conn):
    db_pool.putconn(conn)

# ==========================================================
# FLASK APP
# ==========================================================
app = Flask(__name__)

# ==========================================================
# MQTT CONFIG
# ==========================================================
MQTT_BROKER = "localhost"
MQTT_PORT = 1883
MQTT_TOPIC = "asset_tracking/readers/+/scan"

# ==========================================================
# MQTT CALLBACKS
# ==========================================================
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✓ MQTT Connected")
        client.subscribe(MQTT_TOPIC)
    else:
        print("✗ MQTT Connection failed:", rc)

# ----------------------------------------------------------
def on_message(client, userdata, msg):
    conn = None
    cur = None

    try:
        payload = json.loads(msg.payload.decode())
        event_type = payload.get("event_type")
        reader_code = payload.get("reader")
        uid = payload.get("uid")
        
        # Use timestamp from payload if provided, otherwise use Indian Standard Time
        scan_time_str = payload.get("timestamp") or payload.get("scan_time")
        if scan_time_str:
            try:
                # Parse ISO format timestamp from ESP32
                # Supports formats: "2026-01-21T00:53:46.009191Z" or "2026-01-21 00:53:46"
                if 'T' in scan_time_str:
                    now = datetime.fromisoformat(scan_time_str.replace('Z', '+00:00'))
                else:
                    now = datetime.strptime(scan_time_str, "%Y-%m-%d %H:%M:%S")
                
                # Convert to IST if timezone-naive
                if now.tzinfo is None:
                    ist = pytz.timezone('Asia/Kolkata')
                    now = ist.localize(now)
                else:
                    # Convert to IST if in different timezone
                    ist = pytz.timezone('Asia/Kolkata')
                    now = now.astimezone(ist)
                
                # Make timezone-naive for database (postgres will handle it)
                now = now.replace(tzinfo=None)
                
            except (ValueError, AttributeError) as e:
                # Fallback to IST server time if parsing fails
                ist = pytz.timezone('Asia/Kolkata')
                now = datetime.now(ist).replace(tzinfo=None)
                print(f"⚠ Invalid timestamp in payload: {e}, using IST server time")
        else:
            # Use Indian Standard Time as default
            ist = pytz.timezone('Asia/Kolkata')
            now = datetime.now(ist).replace(tzinfo=None)

        conn = get_db_connection()
        conn.autocommit = False
        cur = conn.cursor()

        # --------------------------------------------------
        # Resolve reader → room
        # --------------------------------------------------
        cur.execute("""
            SELECT rr.reader_id, r.room_id
            FROM room_rfid_readers rr
            JOIN rooms r ON rr.room_id = r.room_id
            WHERE rr.reader_code = %s
        """, (reader_code,))
        reader = cur.fetchone()

        if not reader:
            print(f"⚠ Unknown reader: {reader_code}")
            print(f"   Payload: {payload}")
            
            # Query available readers for debugging
            cur.execute("""
                SELECT reader_code, room_id 
                FROM room_rfid_readers 
                ORDER BY reader_code
            """)
            available_readers = cur.fetchall()
            print(f"   Available readers in database:")
            for r in available_readers:
                print(f"     - {r[0]} (room_id: {r[1]})")
            
            conn.rollback()
            return

        reader_id, room_id = reader

        # --------------------------------------------------
        # BOOT EVENT
        # --------------------------------------------------
        if event_type == "boot":
            cur.execute("""
                INSERT INTO esp32_health_logs
                (reader_id, event_type, recorded_at)
                VALUES (%s, 'BOOT', %s)
            """, (reader_id, now))
            conn.commit()
            print("✓ Boot logged:", reader_code)
            return

        # --------------------------------------------------
        # ONLY SCAN EVENTS BELOW
        # --------------------------------------------------
        if event_type != "scan":
            conn.rollback()
            return

        # --------------------------------------------------
        # Resolve RFID tag → asset
        # --------------------------------------------------
        cur.execute("""
            SELECT tag_id, asset_id
            FROM asset_tags
            WHERE rfid_uid = %s
        """, (uid,))
        tag = cur.fetchone()

        # --------------------------------------------------
        # UNKNOWN TAG HANDLING
        # --------------------------------------------------
        if not tag:
            print(f"⚠ Unknown RFID tag: {uid} scanned by reader: {reader_code}")
            
            # Get room/location details for the alert message
            cur.execute("""
                SELECT r.room_name, f.name AS floor_name, b.name AS building_name
                FROM rooms r
                JOIN floors f ON r.floor_id = f.floor_id
                JOIN buildings b ON f.building_id = b.building_id
                WHERE r.room_id = %s
            """, (room_id,))
            
            location = cur.fetchone()
            if location:
                room_name, floor_name, building_name = location
                alert_msg = f"Unknown RFID tag ({uid}) scanned at {room_name}, {floor_name}, {building_name}"
            else:
                alert_msg = f"Unknown RFID tag scanned: {uid}"
            
            # Create alert for unknown asset (using a dummy asset_id or modify your schema)
            # Option 1: Create alert with asset_id = NULL (requires schema change)
            # Option 2: Use a special "Unknown Asset" record in assets table (asset_id = 0 or -1)
            # Option 3: Store in alerts without asset_id constraint
            
            try:
                # Attempt to insert alert - you may need to modify alerts table to allow NULL asset_id
                cur.execute("""
                    INSERT INTO alerts
                    (asset_id, alert_type, alert_message, generated_at)
                    VALUES (NULL, 'Unknown Asset', %s, %s)
                """, (alert_msg, now))
            except psycopg2.errors.NotNullViolation:
                # If asset_id is required, log to unknown_tag_scans table instead
                print(f"⚠ Cannot create alert - asset_id is required. Logging to unknown_tag_scans.")
                try:
                    cur.execute("""
                        INSERT INTO unknown_tag_scans
                        (rfid_uid, reader_id, room_id, scan_time, alert_message)
                        VALUES (%s, %s, %s, %s, %s)
                    """, (uid, reader_id, room_id, now, alert_msg))
                except psycopg2.Error:
                    # Table doesn't exist, just log to console
                    print(f"⚠ Unknown tag {uid} - unable to store (unknown_tag_scans table may not exist)")
            
            conn.commit()
            print(f"🚨 Unknown asset alert created for tag: {uid}")
            return

        tag_id, asset_id = tag

        # --------------------------------------------------
        # DUPLICATE SCAN SUPPRESSION (10 sec)
        # --------------------------------------------------
        cur.execute("""
            SELECT 1 FROM asset_room_scan_events
            WHERE asset_id = %s
              AND room_id = %s
              AND scan_time > %s
        """, (asset_id, room_id, now - timedelta(seconds=10)))

        if cur.fetchone():
            conn.rollback()
            print("⏭ Duplicate scan ignored")
            return

        # --------------------------------------------------
        # STORE SCAN EVENT
        # --------------------------------------------------
        cur.execute("""
            INSERT INTO asset_room_scan_events
            (asset_id, tag_id, reader_id, room_id, scan_time)
            VALUES (%s, %s, %s, %s, %s)
        """, (asset_id, tag_id, reader_id, room_id, now))

        # --------------------------------------------------
        # UPDATE ASSET STATUS
        # --------------------------------------------------
        cur.execute("""
            INSERT INTO asset_status
            (asset_id, status, recorded_at)
            VALUES (%s, 'Active', %s)
        """, (asset_id, now))

        # --------------------------------------------------
        # AUTO-ACKNOWLEDGE "MISSING ASSET" ALERTS
        # --------------------------------------------------
        cur.execute("""
            UPDATE alerts
            SET acknowledged_at = %s,
                acknowledged_by = 0
            WHERE asset_id = %s
              AND alert_type = 'Missing Asset'
              AND acknowledged_at IS NULL
        """, (now, asset_id))
        
        if cur.rowcount > 0:
            print(f"✓ Auto-acknowledged {cur.rowcount} 'Missing Asset' alert(s) for asset {asset_id}")

        # --------------------------------------------------
        # CHECK & CREATE GEOFENCE VIOLATION ALERT
        # --------------------------------------------------
        cur.execute("""
            SELECT 1
            FROM asset_allowed_locations aal
            JOIN rooms r ON r.room_id = %s
            JOIN floors f ON r.floor_id = f.floor_id
            JOIN buildings b ON f.building_id = b.building_id
            WHERE aal.asset_id = %s
              AND (
                aal.room_id = r.room_id OR
                aal.floor_id = f.floor_id OR
                aal.building_id = b.building_id
              )
        """, (room_id, asset_id))

        if not cur.fetchone():
            # Get location details for the alert message
            cur.execute("""
                SELECT r.room_name, f.name AS floor_name, b.name AS building_name
                FROM rooms r
                JOIN floors f ON r.floor_id = f.floor_id
                JOIN buildings b ON f.building_id = b.building_id
                WHERE r.room_id = %s
            """, (room_id,))
            
            location = cur.fetchone()
            if location:
                room_name, floor_name, building_name = location
                alert_msg = f"Asset scanned in unauthorized location: {room_name}, {floor_name}, {building_name}"
            else:
                alert_msg = "Asset scanned in unauthorized location"
            
            cur.execute("""
                INSERT INTO alerts
                (asset_id, alert_type, alert_message, generated_at)
                VALUES (%s, 'Geofencing Alert', %s, %s)
            """, (asset_id, alert_msg, now))
            print(f"🚨 Geofence violation alert created for asset {asset_id}")

        # --------------------------------------------------
        # UPDATE ASSET UTILIZATION METRICS (if table exists)
        # --------------------------------------------------
        try:
            # Check if asset was previously idle/missing and is now active
            cur.execute("""
                SELECT status, recorded_at
                FROM asset_status
                WHERE asset_id = %s
                  AND recorded_at < %s
                ORDER BY recorded_at DESC
                LIMIT 1
            """, (asset_id, now))
            
            previous_status = cur.fetchone()
            
            # If transitioning from Idle/Missing to Active, update utilization
            if previous_status and previous_status[0] in ['Idle', 'Missing']:
                idle_duration_minutes = (now - previous_status[1]).total_seconds() / 60
                
                # Log utilization event (you may need to create this table)
                cur.execute("""
                    INSERT INTO asset_utilization_log
                    (asset_id, event_type, duration_minutes, recorded_at)
                    VALUES (%s, 'REACTIVATED', %s, %s)
                    ON CONFLICT DO NOTHING
                """, (asset_id, idle_duration_minutes, now))
                
        except psycopg2.Error as e:
            # Table might not exist, continue without logging
            print(f"⚠ Could not update utilization metrics: {e}")

        # --------------------------------------------------
        # UPDATE READER HEALTH METRICS
        # --------------------------------------------------
        # Only insert basic scan event - wifi stats come from separate heartbeat messages
        try:
            cur.execute("""
                INSERT INTO esp32_health_logs
                (reader_id, event_type, recorded_at)
                VALUES (%s, 'SCAN', %s)
            """, (reader_id, now))
        except psycopg2.Error as e:
            print(f"⚠ Could not log reader health: {e}")
            # Continue processing even if health log fails

        # --------------------------------------------------
        # COMMIT ALL CHANGES
        # --------------------------------------------------
        conn.commit()
        print(f"✓ Scan processed successfully for asset {asset_id} in room {room_id}")

    except Exception as e:
        print("❌ Error processing MQTT message")
        traceback.print_exc()
        if conn:
            conn.rollback()

    finally:
        if cur:
            cur.close()
        if conn:
            return_db_connection(conn)

# ==========================================================
# MQTT THREAD
# ==========================================================
def mqtt_thread():
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message
    client.connect(MQTT_BROKER, MQTT_PORT, 60)
    client.loop_forever()

threading.Thread(target=mqtt_thread, daemon=True).start()

# ==========================================================
# FLASK ROUTES
# ==========================================================
@app.route("/")
def index():
    return jsonify({"status": "running"})

@app.route("/scans")
def scans():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT s.scan_time, a.asset_code, r.room_name
        FROM asset_room_scan_events s
        JOIN assets a ON s.asset_id = a.asset_id
        JOIN rooms r ON s.room_id = r.room_id
        ORDER BY s.scan_time DESC
        LIMIT 50
    """)
    rows = cur.fetchall()
    cur.close()
    return_db_connection(conn)
    return jsonify(rows)

@app.route("/alerts")
def alerts():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT alert_type, alert_message, generated_at
        FROM alerts
        ORDER BY generated_at DESC
        LIMIT 50
    """)
    rows = cur.fetchall()
    cur.close()
    return_db_connection(conn)
    return jsonify(rows)

@app.route("/health")
def health():
    return jsonify({"status": "healthy"})

# ==========================================================
# RUN FLASK
# ==========================================================
if __name__ == "__main__":
    print("🚀 Asset Tracking Backend Running")
    app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=False)