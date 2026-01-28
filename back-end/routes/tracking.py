from flask import Blueprint, jsonify
from db import fetch_all

tracking_bp = Blueprint("tracking", __name__)

@tracking_bp.route("/current", methods=["GET"])
def current_locations():
    """Get current location of all assets with building and floor information"""
    rows = fetch_all("""
        SELECT
            a.asset_id,
            a.asset_code,
            a.asset_name,
            a.asset_type,
            r.room_id,
            r.room_name AS current_room,
            f.floor_id,
            f.name AS floor_name,
            b.building_id,
            b.name AS building_name,
            l.scan_time AS last_seen_at,
            CASE
                WHEN EXTRACT(EPOCH FROM (NOW() - l.scan_time))/60 < 1440 THEN 'Active'
                ELSE 'Missing'
            END AS activity_status
        FROM assets a
        LEFT JOIN LATERAL (
            SELECT room_id, scan_time
            FROM asset_room_scan_events
            WHERE asset_id = a.asset_id
            ORDER BY scan_time DESC
            LIMIT 1
        ) l ON TRUE
        LEFT JOIN rooms r ON l.room_id = r.room_id
        LEFT JOIN floors f ON r.floor_id = f.floor_id
        LEFT JOIN buildings b ON f.building_id = b.building_id
        ORDER BY a.asset_code
    """)
    return jsonify(rows)


@tracking_bp.route("/history", methods=["GET"])
def movement_history():
    """Get asset movement history for the last 24 hours"""
    rows = fetch_all("""
        SELECT
            a.asset_id,
            a.asset_code,
            a.asset_name,
            r.room_name,
            arse.scan_time
        FROM asset_room_scan_events arse
        JOIN assets a ON arse.asset_id = a.asset_id
        JOIN rooms r ON arse.room_id = r.room_id
        WHERE arse.scan_time > NOW() - INTERVAL '24 hours'
        ORDER BY arse.scan_time DESC
        LIMIT 1000
    """)
    return jsonify(rows)


@tracking_bp.route("/buildings", methods=["GET"])
def get_buildings():
    """Get all buildings"""
    rows = fetch_all("""
        SELECT 
            building_id,
            name
        FROM buildings
        ORDER BY name
    """)
    return jsonify(rows)


@tracking_bp.route("/floors", methods=["GET"])
def get_floors():
    """Get all floors with their building associations"""
    rows = fetch_all("""
        SELECT 
            floor_id,
            building_id,
            floor_level,
            name
        FROM floors
        ORDER BY building_id, floor_level
    """)
    return jsonify(rows)


@tracking_bp.route("/building/<int:building_id>/assets", methods=["GET"])
def assets_by_building(building_id):
    """Get all assets currently in a specific building"""
    rows = fetch_all("""
        SELECT
            a.asset_id,
            a.asset_code,
            a.asset_name,
            a.asset_type,
            r.room_id,
            r.room_name AS current_room,
            f.floor_id,
            f.name AS floor_name,
            b.building_id,
            b.name AS building_name,
            l.scan_time AS last_seen_at,
            CASE
                WHEN EXTRACT(EPOCH FROM (NOW() - l.scan_time))/60 < 1440 THEN 'Active'
                ELSE 'Missing'
            END AS activity_status
        FROM assets a
        LEFT JOIN LATERAL (
            SELECT room_id, scan_time
            FROM asset_room_scan_events
            WHERE asset_id = a.asset_id
            ORDER BY scan_time DESC
            LIMIT 1
        ) l ON TRUE
        LEFT JOIN rooms r ON l.room_id = r.room_id
        LEFT JOIN floors f ON r.floor_id = f.floor_id
        LEFT JOIN buildings b ON f.building_id = b.building_id
        WHERE b.building_id = %s
        ORDER BY a.asset_code
    """, (building_id,))
    return jsonify(rows)


@tracking_bp.route("/floor/<int:floor_id>/assets", methods=["GET"])
def assets_by_floor(floor_id):
    """Get all assets currently on a specific floor"""
    rows = fetch_all("""
        SELECT
            a.asset_id,
            a.asset_code,
            a.asset_name,
            a.asset_type,
            r.room_id,
            r.room_name AS current_room,
            f.floor_id,
            f.name AS floor_name,
            b.building_id,
            b.name AS building_name,
            l.scan_time AS last_seen_at,
            CASE
                WHEN EXTRACT(EPOCH FROM (NOW() - l.scan_time))/60 < 1440 THEN 'Active'
                ELSE 'Missing'
            END AS activity_status
        FROM assets a
        LEFT JOIN LATERAL (
            SELECT room_id, scan_time
            FROM asset_room_scan_events
            WHERE asset_id = a.asset_id
            ORDER BY scan_time DESC
            LIMIT 1
        ) l ON TRUE
        LEFT JOIN rooms r ON l.room_id = r.room_id
        LEFT JOIN floors f ON r.floor_id = f.floor_id
        LEFT JOIN buildings b ON f.building_id = b.building_id
        WHERE f.floor_id = %s
        ORDER BY r.room_name, a.asset_code
    """, (floor_id,))
    return jsonify(rows)


@tracking_bp.route("/room/<int:room_id>/assets", methods=["GET"])
def assets_by_room(room_id):
    """Get all assets currently in a specific room"""
    rows = fetch_all("""
        SELECT
            a.asset_id,
            a.asset_code,
            a.asset_name,
            a.asset_type,
            r.room_name AS current_room,
            l.scan_time AS last_seen_at,
            CASE
                WHEN EXTRACT(EPOCH FROM (NOW() - l.scan_time))/60 < 1440 THEN 'Active'
                ELSE 'Missing'
            END AS activity_status
        FROM assets a
        LEFT JOIN LATERAL (
            SELECT room_id, scan_time
            FROM asset_room_scan_events
            WHERE asset_id = a.asset_id
            ORDER BY scan_time DESC
            LIMIT 1
        ) l ON TRUE
        LEFT JOIN rooms r ON l.room_id = r.room_id
        WHERE l.room_id = %s
        ORDER BY a.asset_code
    """, (room_id,))
    return jsonify(rows)