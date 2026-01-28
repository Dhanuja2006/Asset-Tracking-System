from flask import Blueprint, jsonify
from db import fetch_all

roles_bp = Blueprint("roles", __name__)

@roles_bp.route("/", methods=["GET"])
def get_roles():
    rows = fetch_all("""
        SELECT
            role_id,
            role_name
        FROM roles
        ORDER BY role_name
    """)
    return jsonify(rows)
