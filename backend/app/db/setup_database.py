#!/usr/bin/env python3
"""
EduSmart Database Setup Script
Initializes PostgreSQL database with schema and dummy data
Usage: python setup_database.py
"""

import psycopg2
from psycopg2 import sql
import os
import sys

# Database connection parameters
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "password")
DB_NAME = os.getenv("DB_NAME", "edusmart")

def create_database():
    """Create the database if it doesn't exist"""
    try:
        # Connect to default 'postgres' database to create new db
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database="postgres"
        )
        conn.autocommit = True
        cursor = conn.cursor()
        
        try:
            cursor.execute(sql.SQL("CREATE DATABASE {}").format(
                sql.Identifier(DB_NAME)
            ))
            print(f"✓ Database '{DB_NAME}' created successfully")
        except psycopg2.errors.DuplicateDatabase:
            print(f"✓ Database '{DB_NAME}' already exists")
        
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"✗ Error creating database: {e}")
        sys.exit(1)

def run_schema_file():
    """Execute the SQL schema file"""
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME
        )
        cursor = conn.cursor()
        
        # Read and execute schema file
        schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
        with open(schema_path, 'r') as f:
            schema_sql = f.read()
        
        cursor.execute(schema_sql)
        conn.commit()
        
        print("✓ Schema and dummy data inserted successfully")
        
        # Verify data was inserted
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM courses")
        course_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM chat_messages")
        msg_count = cursor.fetchone()[0]
        
        print(f"\n📊 Data Summary:")
        print(f"   Users: {user_count}")
        print(f"   Courses: {course_count}")
        print(f"   Chat Messages: {msg_count}")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"✗ Error executing schema: {e}")
        sys.exit(1)

def main():
    print("🚀 EduSmart Database Setup")
    print("=" * 50)
    print(f"Host: {DB_HOST}")
    print(f"Port: {DB_PORT}")
    print(f"Database: {DB_NAME}")
    print("=" * 50)
    
    create_database()
    run_schema_file()
    
    print("\n✅ Database setup complete!")
    print("\nConnection string for your backend:")
    print(f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}")

if __name__ == "__main__":
    main()
