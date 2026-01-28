from flask import Blueprint, jsonify, request
from db import fetch_all, execute
from datetime import datetime

alerts_bp = Blueprint("alerts", __name__)

@alerts_bp.route("/", methods=["GET"])
def get_alerts():
    """Get all alerts with filtering options - Only Geofencing and Unknown Asset alerts"""
    status = request.args.get("status", "all")  
    alert_type = request.args.get("type")
    
    base_sql = """
    SELECT
        al.alert_id,
        al.alert_type,
        al.alert_message,
        al.generated_at,
        al.acknowledged_at,
        al.acknowledged_by,
        COALESCE(a.asset_code, 'UNKNOWN') AS asset_code,
        COALESCE(a.asset_name, 'Unknown Asset') AS asset_name,
        d.name AS department_name,
        CAST(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - al.generated_at))/3600 AS FLOAT) AS hours_open
    FROM alerts al
    LEFT JOIN assets a ON al.asset_id = a.asset_id
    LEFT JOIN asset_department_mapping adm ON a.asset_id = adm.asset_id
    LEFT JOIN departments d ON adm.department_id = d.department_id
    WHERE al.alert_type IN ('Geofencing Alert', 'Unknown Asset')
    """
    
    # Filter by status
    if status == "active":
        base_sql += " AND al.acknowledged_at IS NULL"
    elif status == "acknowledged":
        base_sql += " AND al.acknowledged_at IS NOT NULL"
    
    # Filter by type
    if alert_type:
        base_sql += f" AND al.alert_type = '{alert_type}'"
    
    base_sql += " ORDER BY al.generated_at DESC"
    
    try:
        alerts = fetch_all(base_sql)
        # Convert Decimal to float for JSON serialization
        for alert in alerts:
            if 'hours_open' in alert:
                alert['hours_open'] = float(alert['hours_open'])
        return jsonify(alerts), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@alerts_bp.route("/<int:alert_id>/acknowledge", methods=["POST"])
def acknowledge_alert(alert_id):
    """Acknowledge a specific alert"""
    data = request.get_json() or {}
    acknowledged_by = data.get("acknowledged_by", 1)
    
    # Convert string to int if needed
    if isinstance(acknowledged_by, str):
        try:
            acknowledged_by = int(acknowledged_by)
        except ValueError:
            acknowledged_by = 1
    
    sql = """
    UPDATE alerts
    SET acknowledged_at = CURRENT_TIMESTAMP,
        acknowledged_by = %s
    WHERE alert_id = %s AND acknowledged_at IS NULL
    """
    
    try:
        execute(sql, (acknowledged_by, alert_id))
        return jsonify({
            "success": True,
            "alert_id": alert_id,
            "acknowledged_at": datetime.now().isoformat()
        }), 200
    except Exception as e:
        print(f"Error acknowledging alert {alert_id}: {str(e)}")
        return jsonify({"error": str(e)}), 500


@alerts_bp.route("/bulk-acknowledge", methods=["POST"])
def bulk_acknowledge():
    """Acknowledge multiple alerts at once"""
    data = request.get_json()
    alert_ids = data.get("alert_ids", [])
    acknowledged_by = data.get("acknowledged_by", 1)
    
    # Convert string to int if needed
    if isinstance(acknowledged_by, str):
        try:
            acknowledged_by = int(acknowledged_by)
        except ValueError:
            acknowledged_by = 1
    
    if not alert_ids:
        return jsonify({"error": "No alert IDs provided"}), 400
    
    placeholders = ",".join(["%s"] * len(alert_ids))
    sql = f"""
    UPDATE alerts
    SET acknowledged_at = CURRENT_TIMESTAMP,
        acknowledged_by = %s
    WHERE alert_id IN ({placeholders}) AND acknowledged_at IS NULL
    """
    
    try:
        params = [acknowledged_by] + alert_ids
        execute(sql, params)
        return jsonify({
            "success": True,
            "acknowledged_count": len(alert_ids)
        }), 200
    except Exception as e:
        print(f"Error bulk acknowledging alerts: {str(e)}")
        return jsonify({"error": str(e)}), 500


@alerts_bp.route("/statistics", methods=["GET"])
def get_statistics():
    """Get alert statistics - Only Geofencing and Unknown Asset alerts"""
    sql = """
    SELECT
        COUNT(*) FILTER (WHERE acknowledged_at IS NULL) as active_count,
        COUNT(*) FILTER (WHERE acknowledged_at IS NOT NULL) as acknowledged_count,
        COUNT(*) FILTER (WHERE alert_type = 'Unknown Asset' AND acknowledged_at IS NULL) as unknown_assets,
        COUNT(*) FILTER (WHERE alert_type = 'Geofencing Alert' AND acknowledged_at IS NULL) as geofencing_alerts
    FROM alerts
    WHERE alert_type IN ('Geofencing Alert', 'Unknown Asset')
    """
    
    try:
        stats = fetch_all(sql)
        return jsonify(stats[0] if stats else {}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500