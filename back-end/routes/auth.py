from flask import Blueprint, request, jsonify
from db import fetch_one
import jwt
import bcrypt
import os
from datetime import datetime, timedelta

auth_bp = Blueprint('auth', __name__)

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")

def verify_password(password: str, hashed_password: str) -> bool:
    """Verify a password against a hash"""
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception as e:
        print(f"Password verification error: {e}")
        return False

@auth_bp.route("/login", methods=["POST", "OPTIONS"])
def login():
    # Handle preflight OPTIONS request
    if request.method == "OPTIONS":
        return "", 200
    
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")
    
    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400
    
    # Fetch user from database INCLUDING password_hash
    query = """
        SELECT u.user_id, u.name, u.email, u.department_id, u.password_hash, r.role_name
        FROM users u
        LEFT JOIN user_roles ur ON u.user_id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.role_id
        WHERE u.email = %s
        LIMIT 1
    """
    user = fetch_one(query, (email,))
    
    if not user:
        return jsonify({"error": "Invalid email or password"}), 401
    
    # Check if password_hash exists
    if not user.get('password_hash'):
        return jsonify({"error": "Account not configured. Please contact administrator."}), 401
    
    # Verify password
    if not verify_password(password, user['password_hash']):
        return jsonify({"error": "Invalid email or password"}), 401
    
    # Generate JWT token
    token = jwt.encode({
        'user_id': user['user_id'],
        'email': user['email'],
        'exp': datetime.utcnow() + timedelta(hours=24)
    }, SECRET_KEY, algorithm='HS256')
    
    return jsonify({
        "token": token,
        "user": {
            "user_id": user['user_id'],
            "name": user['name'],
            "email": user['email'],
            "department_id": user['department_id'],
            "role": user['role_name']
        }
    }), 200

@auth_bp.route("/verify", methods=["GET", "OPTIONS"])
def verify_token():
    # Handle preflight OPTIONS request
    if request.method == "OPTIONS":
        return "", 200
        
    auth_header = request.headers.get('Authorization')
    
    if not auth_header:
        return jsonify({"error": "No token provided"}), 401
    
    try:
        token = auth_header.split(' ')[1]
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        
        # Fetch fresh user data
        query = """
            SELECT u.user_id, u.name, u.email, u.department_id, r.role_name
            FROM users u
            LEFT JOIN user_roles ur ON u.user_id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.role_id
            WHERE u.user_id = %s
            LIMIT 1
        """
        user = fetch_one(query, (payload['user_id'],))
        
        if not user:
            return jsonify({"error": "User not found"}), 401
        
        return jsonify({
            "user": {
                "user_id": user['user_id'],
                "name": user['name'],
                "email": user['email'],
                "department_id": user['department_id'],
                "role": user['role_name']
            }
        }), 200
        
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401

@auth_bp.route("/change-password", methods=["POST", "OPTIONS"])
def change_password():
    """Allow users to change their password"""
    if request.method == "OPTIONS":
        return "", 200
    
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return jsonify({"error": "Not authenticated"}), 401
    
    try:
        token = auth_header.split(' ')[1]
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        user_id = payload['user_id']
        
        data = request.get_json()
        old_password = data.get("old_password")
        new_password = data.get("new_password")
        
        if not old_password or not new_password:
            return jsonify({"error": "Both old and new password required"}), 400
        
        if len(new_password) < 6:
            return jsonify({"error": "New password must be at least 6 characters"}), 400
        
        # Get current password hash
        from db import fetch_one, execute
        user = fetch_one("SELECT password_hash FROM users WHERE user_id = %s", (user_id,))
        
        if not user or not verify_password(old_password, user['password_hash']):
            return jsonify({"error": "Current password is incorrect"}), 401
        
        # Hash new password
        salt = bcrypt.gensalt()
        new_hash = bcrypt.hashpw(new_password.encode('utf-8'), salt).decode('utf-8')
        
        # Update password
        execute("UPDATE users SET password_hash = %s WHERE user_id = %s", (new_hash, user_id))
        
        return jsonify({"message": "Password changed successfully"}), 200
        
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401