from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from db import fetch_all
import os

from routes.meta import meta_bp
from routes.dashboard import dashboard_bp
from routes.assets import assets_bp
from routes.alerts import alerts_bp
from routes.readers import readers_bp
from routes.tracking import tracking_bp
from routes.inventory import inventory_bp
from routes.analytics import analytics_bp
from routes.reports import reports_bp
from routes.auth import auth_bp
from routes.users import users_bp
from routes.maintenance import maintenance_bp
from routes.vendors import vendors_bp
from routes.roles import roles_bp

load_dotenv()

app = Flask(__name__)
app.url_map.strict_slashes = False  
CORS(app)

# Register all blueprints
app.register_blueprint(maintenance_bp, url_prefix="/api/maintenance")
app.register_blueprint(vendors_bp, url_prefix="/api/vendors")
app.register_blueprint(dashboard_bp, url_prefix="/api/dashboard")
app.register_blueprint(assets_bp, url_prefix="/api/assets")
app.register_blueprint(alerts_bp, url_prefix="/api/alerts")
app.register_blueprint(readers_bp, url_prefix="/api/readers")
app.register_blueprint(tracking_bp, url_prefix="/api/tracking")
app.register_blueprint(inventory_bp, url_prefix="/api/inventory")
app.register_blueprint(analytics_bp, url_prefix="/api/analytics")
app.register_blueprint(reports_bp, url_prefix="/api/reports")
app.register_blueprint(users_bp, url_prefix="/api/users")
app.register_blueprint(auth_bp, url_prefix="/api/auth")
app.register_blueprint(roles_bp, url_prefix="/api/roles")
app.register_blueprint(meta_bp, url_prefix="/api")

EXPECTED_DAILY_SCANS = 20   

# ----------------- GLOBAL ERROR HANDLER -----------------
@app.errorhandler(Exception)
def handle_exception(e):
    return jsonify({"error": str(e)}), 500

@app.route("/api/utilization/daily-by-department", methods=["GET"])
def daily_utilization_by_department():
    query = """
    SELECT
        TO_CHAR(date_trunc('day', s.scan_time), 'Dy') AS day,
        d.name AS department_name,
        ROUND(COUNT(*) * 100.0 / %s, 2) AS utilization
    FROM asset_room_scan_events s
    JOIN assets a ON s.asset_id = a.asset_id
    JOIN asset_department_mapping adm ON a.asset_id = adm.asset_id
    JOIN departments d ON adm.department_id = d.department_id
    WHERE s.scan_time >= NOW() - INTERVAL '7 days'
    GROUP BY day, d.name
    ORDER BY day;
    """
    return jsonify(fetch_all(query, (EXPECTED_DAILY_SCANS,)))

@app.route("/api/utilization/assets", methods=["GET"])
def asset_utilization():
    query = """
    SELECT
        a.asset_id,
        a.asset_code,
        a.asset_name,
        d.name AS department_name,
        cr.room_id AS current_room_id,
        COUNT(s.scan_id) AS scan_count,
        ROUND(
            COUNT(s.scan_id) * 100.0 / %s,
            2
        ) AS utilization_rate,
        COALESCE(
            EXTRACT(EPOCH FROM (NOW() - MAX(s.scan_time))) / 60,
            0
        ) AS minutes_since_seen
    FROM assets a
    LEFT JOIN asset_department_mapping adm
        ON adm.mapping_id = (
            SELECT mapping_id
            FROM asset_department_mapping
            WHERE asset_id = a.asset_id
            ORDER BY mapped_at DESC
            LIMIT 1
        )
    LEFT JOIN departments d
        ON adm.department_id = d.department_id
    LEFT JOIN asset_room_scan_events s
        ON a.asset_id = s.asset_id
        AND DATE(s.scan_time) = CURRENT_DATE
    LEFT JOIN asset_room_scan_events cr
        ON cr.scan_id = (
            SELECT scan_id
            FROM asset_room_scan_events
            WHERE asset_id = a.asset_id
            ORDER BY scan_time DESC
            LIMIT 1
        )
    GROUP BY
        a.asset_id,
        a.asset_code,
        a.asset_name,
        d.name,
        cr.room_id
    ORDER BY utilization_rate DESC;
    """
    return jsonify(fetch_all(query, (EXPECTED_DAILY_SCANS,)))

@app.route("/api/utilization/department-weekly", methods=["GET"])
def department_weekly_utilization():
    query = """
    SELECT
        TO_CHAR(DATE(s.scan_time), 'Dy') AS day,
        d.name AS department_name,
        ROUND(
            COUNT(*) * 100.0 / %s,
            2
        ) AS utilization
    FROM asset_room_scan_events s
    JOIN assets a
        ON s.asset_id = a.asset_id
    JOIN asset_department_mapping adm
        ON a.asset_id = adm.asset_id
    JOIN departments d
        ON adm.department_id = d.department_id
    WHERE s.scan_time >= CURRENT_DATE - INTERVAL '6 days'
    GROUP BY day, d.name
    ORDER BY day;
    """
    rows = fetch_all(query, (EXPECTED_DAILY_SCANS,))
    
    # reshape for Recharts
    response = {}
    for r in rows:
        day = r["day"]
        if day not in response:
            response[day] = {"name": day}
        response[day][r["department_name"]] = r["utilization"]
    
    return jsonify(list(response.values()))

@app.route("/api/assets/category-distribution", methods=["GET"])
def asset_category_distribution():
    query = """
    SELECT
        ac.name AS name,
        COUNT(a.asset_id) AS value
    FROM asset_categories ac
    LEFT JOIN assets a
        ON a.category_id = ac.category_id
    GROUP BY ac.name
    ORDER BY value DESC;
    """
    return jsonify(fetch_all(query))

@app.route("/api/utilization/peak-hours-by-department", methods=["GET"])
def peak_hour_utilization_by_department():
    query = """
    SELECT
        EXTRACT(HOUR FROM s.scan_time) AS hour,
        COALESCE(d.name, 'Unknown') AS department_name,
        COUNT(*) AS scan_count
    FROM asset_room_scan_events s
    LEFT JOIN rooms r ON s.room_id = r.room_id
    LEFT JOIN departments d ON r.department_id = d.department_id
    WHERE s.scan_time >= NOW() - INTERVAL '7 days'
    GROUP BY hour, department_name
    ORDER BY hour, department_name;
    """
    return jsonify(fetch_all(query))

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})

if __name__ == "__main__":
    app.run(port=int(os.getenv("FLASK_PORT", 5000)), debug=True)