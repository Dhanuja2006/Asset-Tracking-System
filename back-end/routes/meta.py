from flask import Blueprint, jsonify
from db import fetch_all

meta_bp = Blueprint("meta", __name__)

@meta_bp.route("/categories", methods=["GET"])
def get_categories():
    return jsonify(fetch_all("""
        SELECT category_id, name
        FROM asset_categories
        ORDER BY name
    """))

@meta_bp.route("/departments", methods=["GET"])
def get_departments():
    return jsonify(fetch_all("""
        SELECT department_id, name
        FROM departments
        ORDER BY name
    """))
