from flask import Blueprint, jsonify
from db import fetch_all

analytics_bp = Blueprint("analytics", __name__)

@analytics_bp.route("/utilization", methods=["GET"])
def utilization_analytics():
    rows = fetch_all("""
        SELECT
            a.asset_id,
            a.asset_code,
            a.asset_name,
            COALESCE(
              ROUND(AVG(
                CASE
                  WHEN arse.scan_time > NOW() - INTERVAL '7 days'
                  THEN 1 ELSE 0
                END
              ) * 100, 2),
              0
            ) AS utilization_rate
        FROM assets a
        LEFT JOIN asset_room_scan_events arse
          ON a.asset_id = arse.asset_id
        GROUP BY a.asset_id
        ORDER BY utilization_rate DESC
    """)
    return jsonify(rows)
