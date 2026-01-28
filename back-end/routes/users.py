from flask import Blueprint, jsonify, request
from db import fetch_all, execute, execute_returning

users_bp = Blueprint("users", __name__)

@users_bp.route("/", methods=["GET"])
def get_users():
    rows = fetch_all("""
        SELECT
            u.user_id,
            u.name,
            u.email,
            r.role_name,
            d.name AS department_name
        FROM users u
        LEFT JOIN user_roles ur ON u.user_id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.role_id
        LEFT JOIN departments d ON u.department_id = d.department_id
        ORDER BY u.user_id
    """)
    return jsonify(rows)


@users_bp.route("/roles", methods=["GET"])
def get_roles():
    rows = fetch_all("""
        SELECT role_id, role_name
        FROM roles
        ORDER BY role_name
    """)
    return jsonify(rows)


@users_bp.route("/", methods=["POST"])
def create_user():
    try:
        data = request.get_json()
        
        # Validate input
        if not data.get('name') or not data.get('email') or not data.get('role_id'):
            return jsonify({"error": "Missing required fields"}), 400
        
        # Insert user and get the new user_id using execute_returning
        user_id = execute_returning("""
            INSERT INTO users (name, email, department_id)
            VALUES (%s, %s, NULL)
            RETURNING user_id
        """, (data['name'], data['email']))
        
        if not user_id:
            return jsonify({"error": "Failed to create user"}), 500
        
        # Assign role to user
        execute("""
            INSERT INTO user_roles (user_id, role_id)
            VALUES (%s, %s)
        """, (user_id, data['role_id']))
        
        return jsonify({"success": True, "user_id": user_id}), 201
        
    except Exception as e:
        print(f"Error creating user: {str(e)}")
        return jsonify({"error": str(e)}), 500