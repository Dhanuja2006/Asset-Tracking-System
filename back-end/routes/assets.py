from flask import Blueprint, jsonify, request
from db import fetch_all, execute_returning, execute

assets_bp = Blueprint("assets", __name__)

@assets_bp.route("/", methods=["GET"])
def get_assets():
    """Get all assets with their categories and departments"""
    sql = """
    SELECT
        a.asset_id,
        a.asset_code,
        a.asset_name,
        a.manufacturer,
        a.model,
        a.purchase_cost,
        ac.name AS category_name,
        d.name AS department_name
    FROM assets a
    LEFT JOIN asset_categories ac ON a.category_id = ac.category_id
    LEFT JOIN asset_department_mapping adm ON a.asset_id = adm.asset_id
    LEFT JOIN departments d ON adm.department_id = d.department_id
    ORDER BY a.asset_id DESC
    """
    try:
        assets = fetch_all(sql)
        return jsonify(assets), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@assets_bp.route("/", methods=["POST"])
def add_asset():
    """Add a new asset and optionally map it to a department"""
    try:
        data = request.json
        print(f"Received data: {data}")  # Debug logging
        
        # Validate required fields
        if not data.get('asset_code') or not data.get('asset_name'):
            return jsonify({"error": "asset_code and asset_name are required"}), 400
        
        # Insert the asset
        insert_sql = """
        INSERT INTO assets (asset_code, asset_name, manufacturer, model, purchase_cost)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING asset_id
        """
        
        print(f"Inserting asset with values: {data['asset_code']}, {data['asset_name']}, {data.get('manufacturer')}, {data.get('model')}, {data.get('purchase_cost')}")
        
        asset_id = execute_returning(insert_sql, (
            data['asset_code'],
            data['asset_name'],
            data.get('manufacturer'),
            data.get('model'),
            data.get('purchase_cost')
        ))
        
        print(f"Asset created with ID: {asset_id}")
        
        # If department_id is provided, create the mapping
        if data.get('department_id'):
            mapping_sql = """
            INSERT INTO asset_department_mapping (asset_id, department_id)
            VALUES (%s, %s)
            """
            print(f"Creating department mapping: asset_id={asset_id}, department_id={data['department_id']}")
            execute(mapping_sql, (asset_id, data['department_id']))
        
        return jsonify({
            "success": True,
            "asset_id": asset_id,
            "message": "Asset created successfully"
        }), 201
        
    except Exception as e:
        print(f"Error adding asset: {str(e)}")  # Debug logging
        import traceback
        traceback.print_exc()  # Print full stack trace
        return jsonify({"error": str(e)}), 500


@assets_bp.route("/departments", methods=["GET"])
def get_departments():
    """Get all departments for the dropdown"""
    sql = """
    SELECT department_id, name
    FROM departments
    ORDER BY name
    """
    try:
        departments = fetch_all(sql)
        return jsonify(departments), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@assets_bp.route("/<int:asset_id>", methods=["GET"])
def get_asset(asset_id):
    """Get a single asset by ID"""
    sql = """
    SELECT
        a.asset_id,
        a.asset_code,
        a.asset_name,
        a.manufacturer,
        a.model,
        a.purchase_cost,
        a.category_id,
        ac.name AS category_name,
        d.department_id,
        d.name AS department_name
    FROM assets a
    LEFT JOIN asset_categories ac ON a.category_id = ac.category_id
    LEFT JOIN asset_department_mapping adm ON a.asset_id = adm.asset_id
    LEFT JOIN departments d ON adm.department_id = d.department_id
    WHERE a.asset_id = %s
    """
    try:
        result = fetch_all(sql, (asset_id,))
        if not result:
            return jsonify({"error": "Asset not found"}), 404
        return jsonify(result[0]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@assets_bp.route("/<int:asset_id>", methods=["PUT"])
def update_asset(asset_id):
    """Update an existing asset"""
    try:
        data = request.json
        
        # Update the asset
        update_sql = """
        UPDATE assets
        SET asset_code = %s,
            asset_name = %s,
            manufacturer = %s,
            model = %s,
            purchase_cost = %s
        WHERE asset_id = %s
        """
        
        execute_returning(update_sql, (
            data.get('asset_code'),
            data.get('asset_name'),
            data.get('manufacturer'),
            data.get('model'),
            data.get('purchase_cost'),
            asset_id
        ))
        
        # Update department mapping if provided
        if 'department_id' in data:
            # Delete existing mapping
            delete_sql = "DELETE FROM asset_department_mapping WHERE asset_id = %s"
            execute_returning(delete_sql, (asset_id,))
            
            # Insert new mapping if department_id is not null
            if data['department_id']:
                insert_sql = """
                INSERT INTO asset_department_mapping (asset_id, department_id)
                VALUES (%s, %s)
                """
                execute_returning(insert_sql, (asset_id, data['department_id']))
        
        return jsonify({
            "success": True,
            "message": "Asset updated successfully"
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@assets_bp.route("/<int:asset_id>", methods=["DELETE"])
def delete_asset(asset_id):
    """Delete an asset"""
    try:
        # Delete department mapping first (foreign key constraint)
        delete_mapping_sql = "DELETE FROM asset_department_mapping WHERE asset_id = %s"
        execute_returning(delete_mapping_sql, (asset_id,))
        
        # Delete the asset
        delete_asset_sql = "DELETE FROM assets WHERE asset_id = %s"
        execute_returning(delete_asset_sql, (asset_id,))
        
        return jsonify({
            "success": True,
            "message": "Asset deleted successfully"
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500