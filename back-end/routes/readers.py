from flask import Blueprint, jsonify
from db import fetch_all

readers_bp = Blueprint("readers", __name__)

@readers_bp.route("/", methods=["GET"])
def get_readers():
    rows = fetch_all("""
        SELECT
            rr.reader_id,
            rr.reader_code,
            r.room_name,
            f.name AS floor_name,
            b.name AS building_name,

            CASE
                WHEN hl.recorded_at > NOW() - INTERVAL '5 minutes' THEN 'Online'
                WHEN hl.recorded_at > NOW() - INTERVAL '1 hour' THEN 'Warning'
                ELSE 'Offline'
            END AS status,

            hl.recorded_at AS last_heartbeat,
            pl.voltage AS last_voltage,
            hl.wifi_quality,
            hl.wifi_rssi

        FROM room_rfid_readers rr

        LEFT JOIN rooms r ON rr.room_id = r.room_id
        LEFT JOIN floors f ON r.floor_id = f.floor_id
        LEFT JOIN buildings b ON f.building_id = b.building_id

        LEFT JOIN LATERAL (
            SELECT *
            FROM esp32_health_logs
            WHERE reader_id = rr.reader_id
            ORDER BY recorded_at DESC
            LIMIT 1
        ) hl ON TRUE

        LEFT JOIN LATERAL (
            SELECT *
            FROM esp32_power_logs
            WHERE reader_id = rr.reader_id
            ORDER BY recorded_at DESC
            LIMIT 1
        ) pl ON TRUE

        ORDER BY rr.reader_code
    """)
    return jsonify(rows)
