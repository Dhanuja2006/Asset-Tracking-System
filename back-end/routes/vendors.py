from flask import Blueprint, jsonify
from db import fetch_all

vendors_bp = Blueprint("vendors", __name__)

@vendors_bp.route("/", methods=["GET"])
def vendors():
    rows = fetch_all("""
        SELECT
            vendor_id,
            vendor_name,
            contact_person,
            phone,
            email
        FROM vendors
        ORDER BY vendor_name
    """)

    return jsonify({
        "data": rows   
    })
