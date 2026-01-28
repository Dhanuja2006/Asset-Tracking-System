from flask import Blueprint, request, jsonify
from datetime import datetime
from db import fetch_all, fetch_one, execute_returning_dict

maintenance_bp = Blueprint("maintenance", __name__)

# --------------------------------------------------
# Schedule
# --------------------------------------------------
@maintenance_bp.route("/schedule", methods=["POST"])
def schedule():
    data = request.json

    required = ["asset_id", "maintenance_type", "scheduled_date", "recorded_by"]
    if not all(k in data for k in required):
        return jsonify({"error": "Missing required fields"}), 400

    query = """
    INSERT INTO asset_maintenance_records
    (asset_id, vendor_id, maintenance_type, description,
     maintenance_start, maintenance_cost, recorded_by, recorded_at)
    VALUES (%s,%s,%s,%s,%s,%s,%s,NOW())
    RETURNING maintenance_id
    """

    row = execute_returning_dict(query, (
        data["asset_id"],
        data.get("vendor_id"),
        data["maintenance_type"],
        data.get("description"),
        data["scheduled_date"],
        data.get("maintenance_cost"),
        data["recorded_by"]
    ))

    return jsonify({
        "data": row,
        "message": "Maintenance scheduled"
    }), 201


# --------------------------------------------------
# Complete
# --------------------------------------------------
@maintenance_bp.route("/complete", methods=["PUT"])
def complete():
    data = request.json

    query = """
    UPDATE asset_maintenance_records
    SET maintenance_end = %s,
        maintenance_cost = COALESCE(%s, maintenance_cost)
    WHERE maintenance_id = %s
    RETURNING maintenance_id
    """

    row = execute_returning_dict(query, (
        data.get("completion_date", datetime.now()),
        data.get("maintenance_cost"),
        data["maintenance_id"]
    ))

    if not row:
        return jsonify({"error": "Not found"}), 404

    return jsonify({"message": "Completed"})


# --------------------------------------------------
# Postpone
# --------------------------------------------------
@maintenance_bp.route("/postpone", methods=["PUT"])
def postpone():
    data = request.json

    query = """
    UPDATE asset_maintenance_records
    SET maintenance_start = %s
    WHERE maintenance_id = %s
    RETURNING maintenance_id
    """

    row = execute_returning_dict(query, (
        data["new_date"],
        data["maintenance_id"]
    ))

    if not row:
        return jsonify({"error": "Not found"}), 404

    return jsonify({"message": "Postponed"})


# --------------------------------------------------
# Delete
# --------------------------------------------------
@maintenance_bp.route("/delete/<int:maintenance_id>", methods=["DELETE"])
def delete(maintenance_id):
    query = """
    DELETE FROM asset_maintenance_records
    WHERE maintenance_id = %s
    RETURNING maintenance_id
    """

    row = execute_returning_dict(query, (maintenance_id,))

    if not row:
        return jsonify({"error": "Maintenance record not found"}), 404

    return jsonify({"message": "Maintenance record deleted successfully"}), 200


# --------------------------------------------------
# All Records
# --------------------------------------------------
@maintenance_bp.route("/all", methods=["GET"])
def all_records():

    status = request.args.get("status")

    query = """
    SELECT
        m.*,
        a.asset_code,
        a.asset_name,
        v.vendor_name,
        CASE
            WHEN m.maintenance_end IS NOT NULL THEN 'Completed'
            WHEN m.maintenance_start < NOW() THEN 'Overdue'
            ELSE 'Scheduled'
        END AS status
    FROM asset_maintenance_records m
    JOIN assets a ON m.asset_id = a.asset_id
    LEFT JOIN vendors v ON m.vendor_id = v.vendor_id
    WHERE 1=1
    """

    if status == "pending":
        query += " AND m.maintenance_end IS NULL"
    elif status == "completed":
        query += " AND m.maintenance_end IS NOT NULL"

    query += " ORDER BY m.maintenance_start DESC"

    rows = fetch_all(query)

    return jsonify({
        "data": rows
    })


# --------------------------------------------------
# Stats
# --------------------------------------------------
@maintenance_bp.route("/stats", methods=["GET"])
def stats():

    query = """
    SELECT
        COUNT(*) FILTER (WHERE maintenance_end IS NULL AND maintenance_start < NOW()) AS overdue,
        COUNT(*) FILTER (WHERE maintenance_end IS NULL) AS total_pending,
        COUNT(*) FILTER (WHERE maintenance_end IS NOT NULL) AS completed_this_month,
        COUNT(*) FILTER (
            WHERE maintenance_end IS NULL
            AND maintenance_start <= NOW() + INTERVAL '7 days'
        ) AS due_this_week,
        COALESCE(SUM(maintenance_cost) FILTER (WHERE maintenance_end IS NOT NULL), 0) AS total_cost_completed
    FROM asset_maintenance_records
    """

    row = fetch_one(query)

    return jsonify(row)