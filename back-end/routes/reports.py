from flask import Blueprint, request, jsonify
from db import fetch_all, fetch_one
from datetime import datetime, timedelta

reports_bp = Blueprint("reports", __name__)

# =====================================================
# DEPARTMENT REPORTS
# =====================================================
@reports_bp.route("/department-summary", methods=["GET"])
def department_summary():
    """Get asset distribution and value by department"""
    query = """
    SELECT 
        d.name AS department,
        COUNT(a.asset_id) AS total_assets,
        
        -- Count assets with recent scans as "in use"
        COUNT(CASE 
            WHEN EXISTS (
                SELECT 1 FROM asset_room_scan_events arse 
                WHERE arse.asset_id = a.asset_id 
                AND arse.scan_time >= NOW() - INTERVAL '24 hours'
            ) THEN 1 
        END) AS in_use,
        
        -- Count assets without recent scans as "available"
        COUNT(CASE 
            WHEN NOT EXISTS (
                SELECT 1 FROM asset_room_scan_events arse 
                WHERE arse.asset_id = a.asset_id 
                AND arse.scan_time >= NOW() - INTERVAL '24 hours'
            ) THEN 1 
        END) AS available,
        
        -- Utilization percentage (COALESCE ensures no null)
        COALESCE(
            ROUND(
                COUNT(CASE 
                    WHEN EXISTS (
                        SELECT 1 FROM asset_room_scan_events arse 
                        WHERE arse.asset_id = a.asset_id 
                        AND arse.scan_time >= NOW() - INTERVAL '24 hours'
                    ) THEN 1 
                END)::NUMERIC / 
                NULLIF(COUNT(a.asset_id), 0) * 100, 
                1
            ),
            0
        ) AS utilization_percentage,
        
        COALESCE(SUM(a.purchase_cost), 0) AS total_value
    FROM departments d
    LEFT JOIN asset_department_mapping adm ON d.department_id = adm.department_id
    LEFT JOIN assets a ON adm.asset_id = a.asset_id
    GROUP BY d.name, d.department_id
    HAVING COUNT(a.asset_id) > 0
    ORDER BY total_value DESC
    """
    
    rows = fetch_all(query)
    return jsonify({"data": rows})

# =====================================================
# UTILIZATION REPORTS
# =====================================================
@reports_bp.route("/utilization-trends", methods=["GET"])
def utilization_trends():
    """Get asset utilization trends with detailed metrics"""
    time_range = request.args.get('time_range', 'week')  # day, week, month, quarter, year
    
    # Map time ranges to intervals
    interval_map = {
        'day': '1 day',
        'week': '7 days',
        'month': '30 days',
        'quarter': '90 days',
        'year': '365 days'
    }
    
    interval = interval_map.get(time_range, '7 days')
    
    query = f"""
    SELECT 
        a.asset_code,
        a.asset_name,
        ac.name AS category,
        
        -- Average utilization
        COALESCE(
            ROUND(
                COUNT(DISTINCT DATE(s.scan_time))::NUMERIC / 
                EXTRACT(DAY FROM INTERVAL '{interval}') * 100,
                1
            ),
            0
        ) AS avg_utilization,
        
        -- Peak hours (most common hour of scans)
        MODE() WITHIN GROUP (ORDER BY EXTRACT(HOUR FROM s.scan_time)) AS peak_hour,
        
        -- Total scan count
        COUNT(s.scan_id) AS total_scans,
        
        -- Idle time (minutes since last seen)
        COALESCE(
            EXTRACT(EPOCH FROM (NOW() - MAX(s.scan_time))) / 60,
            0
        ) AS idle_minutes,
        
        -- Status based on utilization
        CASE 
            WHEN COUNT(DISTINCT DATE(s.scan_time))::NUMERIC / 
                 EXTRACT(DAY FROM INTERVAL '{interval}') * 100 >= 70 THEN 'Optimal'
            WHEN COUNT(DISTINCT DATE(s.scan_time))::NUMERIC / 
                 EXTRACT(DAY FROM INTERVAL '{interval}') * 100 >= 40 THEN 'Moderate'
            ELSE 'Under-utilized'
        END AS status
        
    FROM assets a
    LEFT JOIN asset_categories ac ON a.category_id = ac.category_id
    LEFT JOIN asset_room_scan_events s 
        ON a.asset_id = s.asset_id 
        AND s.scan_time >= NOW() - INTERVAL '{interval}'
    GROUP BY a.asset_id, a.asset_code, a.asset_name, ac.name
    ORDER BY avg_utilization DESC
    """
    
    rows = fetch_all(query)
    return jsonify({"data": rows})


# =====================================================
# MAINTENANCE REPORTS
# =====================================================
@reports_bp.route("/maintenance-history", methods=["GET"])
def maintenance_history():
    """Get maintenance history with detailed information"""
    time_range = request.args.get('time_range', 'month')
    
    interval_map = {
        'week': '7 days',
        'month': '30 days',
        'quarter': '90 days',
        'year': '365 days'
    }
    
    interval = interval_map.get(time_range, '30 days')
    
    query = f"""
    SELECT 
        a.asset_code,
        a.asset_name,
        v.vendor_name,
        m.maintenance_type,
        m.maintenance_start,
        m.maintenance_end,
        m.maintenance_cost,
        
        -- Calculate duration in hours
        CASE 
            WHEN m.maintenance_end IS NOT NULL THEN
                EXTRACT(EPOCH FROM (m.maintenance_end - m.maintenance_start)) / 3600
            ELSE NULL
        END AS maintenance_hours,
        
        d.name AS department_name,
        
        -- Status
        CASE 
            WHEN m.maintenance_end IS NOT NULL THEN 'Completed'
            WHEN m.maintenance_start < NOW() THEN 'Overdue'
            ELSE 'Scheduled'
        END AS status
        
    FROM asset_maintenance_records m
    JOIN assets a ON m.asset_id = a.asset_id
    LEFT JOIN vendors v ON m.vendor_id = v.vendor_id
    LEFT JOIN asset_department_mapping adm ON a.asset_id = adm.asset_id
    LEFT JOIN departments d ON adm.department_id = d.department_id
    WHERE m.maintenance_start >= NOW() - INTERVAL '{interval}'
    ORDER BY m.maintenance_start DESC
    """
    
    rows = fetch_all(query)
    return jsonify({"data": rows})


@reports_bp.route("/maintenance-summary", methods=["GET"])
def maintenance_summary():
    """Get maintenance cost summary by category"""
    query = """
    SELECT 
        ac.name AS category,
        COUNT(DISTINCT a.asset_id) AS asset_count,
        COUNT(m.maintenance_id) AS maintenance_count,
        COALESCE(SUM(m.maintenance_cost), 0) AS total_maintenance_cost,
        COALESCE(AVG(m.maintenance_cost), 0) AS avg_cost_per_maintenance,
        COALESCE(
            SUM(m.maintenance_cost) / NULLIF(COUNT(DISTINCT a.asset_id), 0),
            0
        ) AS cost_per_asset
    FROM asset_categories ac
    LEFT JOIN assets a ON ac.category_id = a.category_id
    LEFT JOIN asset_maintenance_records m ON a.asset_id = m.asset_id
    WHERE m.maintenance_end IS NOT NULL  -- Only completed maintenance
    GROUP BY ac.name
    ORDER BY total_maintenance_cost DESC
    """
    
    rows = fetch_all(query)
    return jsonify({"data": rows})


# =====================================================
# FINANCIAL REPORTS (TCO)
# =====================================================
@reports_bp.route("/tco-summary", methods=["GET"])
def tco_summary():
    """Total Cost of Ownership summary"""
    query = """
    SELECT 
        ac.name AS category,
        COUNT(a.asset_id) AS asset_count,
        
        -- Purchase costs
        COALESCE(SUM(a.purchase_cost), 0) AS total_purchase_cost,
        
        -- Maintenance costs (completed only)
        COALESCE(
            SUM(m.maintenance_cost) FILTER (WHERE m.maintenance_end IS NOT NULL),
            0
        ) AS total_maintenance_cost,
        
        -- Total TCO
        COALESCE(SUM(a.purchase_cost), 0) + 
        COALESCE(
            SUM(m.maintenance_cost) FILTER (WHERE m.maintenance_end IS NOT NULL),
            0
        ) AS total_tco,
        
        -- Cost per asset
        (
            COALESCE(SUM(a.purchase_cost), 0) + 
            COALESCE(
                SUM(m.maintenance_cost) FILTER (WHERE m.maintenance_end IS NOT NULL),
                0
            )
        ) / NULLIF(COUNT(a.asset_id), 0) AS cost_per_asset
        
    FROM asset_categories ac
    LEFT JOIN assets a ON ac.category_id = a.category_id
    LEFT JOIN asset_maintenance_records m ON a.asset_id = m.asset_id
    GROUP BY ac.name
    HAVING COUNT(a.asset_id) > 0
    ORDER BY total_tco DESC
    """
    
    rows = fetch_all(query)
    return jsonify({"data": rows})


@reports_bp.route("/financial-overview", methods=["GET"])
def financial_overview():
    """Get overall financial metrics"""
    query = """
    SELECT 
        -- Total acquisition cost
        (SELECT COALESCE(SUM(purchase_cost), 0) FROM assets) AS total_acquisition_cost,
        
        -- Maintenance cost YTD
        (SELECT COALESCE(SUM(maintenance_cost), 0) 
         FROM asset_maintenance_records 
         WHERE EXTRACT(YEAR FROM maintenance_start) = EXTRACT(YEAR FROM NOW())
         AND maintenance_end IS NOT NULL) AS maintenance_cost_ytd,
        
        -- Maintenance cost this month
        (SELECT COALESCE(SUM(maintenance_cost), 0) 
         FROM asset_maintenance_records 
         WHERE DATE_TRUNC('month', maintenance_start) = DATE_TRUNC('month', NOW())
         AND maintenance_end IS NOT NULL) AS maintenance_cost_this_month,
        
        -- Average cost per asset
        (SELECT COALESCE(AVG(purchase_cost), 0) FROM assets) AS avg_asset_cost,
        
        -- Total assets
        (SELECT COUNT(*) FROM assets) AS total_assets,
        
        -- Completed maintenance count
        (SELECT COUNT(*) 
         FROM asset_maintenance_records 
         WHERE maintenance_end IS NOT NULL) AS completed_maintenance_count
    """
    
    row = fetch_one(query)
    return jsonify(row)


# =====================================================
# ASSET VALUE REPORTS
# =====================================================
@reports_bp.route("/asset-value-by-department", methods=["GET"])
def asset_value_by_department():
    """Get total asset value grouped by department"""
    query = """
    SELECT 
        d.name AS department,
        COUNT(a.asset_id) AS asset_count,
        COALESCE(SUM(a.purchase_cost), 0) AS total_value,
        COALESCE(AVG(a.purchase_cost), 0) AS avg_value
    FROM departments d
    LEFT JOIN asset_department_mapping adm ON d.department_id = adm.department_id
    LEFT JOIN assets a ON adm.asset_id = a.asset_id
    GROUP BY d.name
    ORDER BY total_value DESC
    """
    
    rows = fetch_all(query)
    return jsonify({"data": rows})


# =====================================================
# QUICK STATS FOR DASHBOARD
# =====================================================
@reports_bp.route("/quick-stats", methods=["GET"])
def quick_stats():
    """Get quick statistics for the reporting dashboard"""
    query = """
    SELECT 
        (SELECT COALESCE(SUM(purchase_cost), 0) FROM assets) AS total_asset_value,
        (SELECT COUNT(*) FROM assets) AS total_assets,
        
        -- Average asset age in months
        (SELECT COALESCE(
            AVG(EXTRACT(EPOCH FROM (NOW() - purchase_date)) / (30 * 24 * 60 * 60)),
            0
        ) FROM assets) AS avg_asset_age_months,
        
        -- Reports generated (mock - you can track this in a reports_log table)
        47 AS reports_generated_this_month,
        
        -- Scheduled reports (mock - you can store this in a scheduled_reports table)
        12 AS scheduled_reports_count
    """
    
    row = fetch_one(query)
    return jsonify(row)


# =====================================================
# LOST/MISSING ASSETS REPORT
# =====================================================
@reports_bp.route("/missing-assets", methods=["GET"])
def missing_assets():
    """Get assets that haven't been scanned in a long time (potentially lost)"""
    days_threshold = request.args.get('days', 30, type=int)
    
    query = """
    SELECT 
        a.asset_code,
        a.asset_name,
        ac.name AS category,
        d.name AS department,
        a.purchase_cost,
        
        -- Last seen
        MAX(s.scan_time) AS last_seen,
        
        -- Days since last seen
        COALESCE(
            EXTRACT(DAY FROM (NOW() - MAX(s.scan_time))),
            999
        ) AS days_since_seen,
        
        -- Last known location
        (SELECT r.room_name 
         FROM asset_room_scan_events arse
         JOIN rooms r ON arse.room_id = r.room_id
         WHERE arse.asset_id = a.asset_id
         ORDER BY arse.scan_time DESC
         LIMIT 1) AS last_known_location
        
    FROM assets a
    LEFT JOIN asset_categories ac ON a.category_id = ac.category_id
    LEFT JOIN asset_department_mapping adm ON a.asset_id = adm.asset_id
    LEFT JOIN departments d ON adm.department_id = d.department_id
    LEFT JOIN asset_room_scan_events s ON a.asset_id = s.asset_id
    GROUP BY a.asset_id, a.asset_code, a.asset_name, ac.name, d.name, a.purchase_cost
    HAVING 
        MAX(s.scan_time) IS NULL OR
        EXTRACT(DAY FROM (NOW() - MAX(s.scan_time))) >= %s
    ORDER BY days_since_seen DESC
    """
    
    rows = fetch_all(query, (days_threshold,))
    return jsonify({"data": rows})


# =====================================================
# EXPORT FUNCTIONALITY (CSV/PDF preparation)
# =====================================================
@reports_bp.route("/export/<report_type>", methods=["GET"])
def prepare_export(report_type):
    """Prepare data for export - frontend will handle actual download"""
    
    # Map report types to their respective endpoints
    report_map = {
        'department': '/api/reports/department-summary',
        'utilization': '/api/reports/utilization-trends',
        'maintenance': '/api/reports/maintenance-history',
        'tco': '/api/reports/tco-summary',
        'missing': '/api/reports/missing-assets'
    }
    
    if report_type not in report_map:
        return jsonify({"error": "Invalid report type"}), 400
    
    return jsonify({
        "message": "Export data prepared",
        "report_type": report_type,
        "timestamp": datetime.now().isoformat(),
        "endpoint": report_map[report_type]
    })