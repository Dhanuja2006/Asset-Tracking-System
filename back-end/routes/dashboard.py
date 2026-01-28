from flask import Blueprint, jsonify
from db import fetch_all

dashboard_bp = Blueprint("dashboard", __name__)

@dashboard_bp.route("/", methods=["GET"])
def dashboard_assets():
    rows = fetch_all("""
        SELECT
            a.asset_id,
            a.asset_code,
            a.asset_name,
            CASE
                WHEN EXTRACT(EPOCH FROM (NOW() - l.scan_time))/60 < 60 THEN 'Idle'
                WHEN EXTRACT(EPOCH FROM (NOW() - l.scan_time))/60 < 1440 THEN 'Active'
                ELSE 'Missing'
            END AS activity_status
        FROM assets a
        LEFT JOIN LATERAL (
            SELECT scan_time
            FROM asset_room_scan_events
            WHERE asset_id = a.asset_id
            ORDER BY scan_time DESC
            LIMIT 1
        ) l ON TRUE
    """)
    return jsonify(rows)
