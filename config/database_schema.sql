-- Database Schema Rebuild for Centralized Panel Management
-- WARNING: This script drops all tables in keclc_db and recreates them.

CREATE DATABASE IF NOT EXISTS keclc_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE keclc_db;

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Drop existing tables if they exist
DROP TABLE IF EXISTS panel_connections;
DROP TABLE IF EXISTS panel_data;
DROP TABLE IF EXISTS panels;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS project_data; -- Legacy table

-- 2. Create projects table
CREATE TABLE projects (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    client VARCHAR(255),
    description TEXT,
    date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_last_draft TINYINT(1) DEFAULT 1 COMMENT '0 for manual save, 1 for auto-save'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Create panels table (Centralized Roster)
CREATE TABLE panels (
    id VARCHAR(50) PRIMARY KEY,
    project_id VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL COMMENT 'e.g. panel-load, power-load, transformer',
    name VARCHAR(255) NOT NULL,
    order_idx INT DEFAULT 0,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Create panel_connections table (Adjacency List for Infinite Hierarchies)
CREATE TABLE panel_connections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id VARCHAR(50) NOT NULL,
    parent_panel_id VARCHAR(50) NOT NULL COMMENT 'The consumer (who draws power)',
    child_panel_id VARCHAR(50) NOT NULL COMMENT 'The supplier (who provides power)',
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_panel_id) REFERENCES panels(id) ON DELETE CASCADE,
    FOREIGN KEY (child_panel_id) REFERENCES panels(id) ON DELETE CASCADE,
    UNIQUE KEY unique_pairing (parent_panel_id, child_panel_id) -- A parent cannot have the identical child twice
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Create panel_data table (JSON Storage for internal calculator forms)
CREATE TABLE panel_data (
    panel_id VARCHAR(50) NOT NULL,
    is_draft TINYINT(1) DEFAULT 0 COMMENT '0 for saved data, 1 for active UI drafts',
    data_json LONGTEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (panel_id, is_draft),
    FOREIGN KEY (panel_id) REFERENCES panels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Recreate necessary global settings support
CREATE TABLE global_settings (
    key_name VARCHAR(100) PRIMARY KEY,
    data_json LONGTEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Create user_profiles table (user_profile.php 연동)
CREATE TABLE IF NOT EXISTS user_profiles (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(100),
    email VARCHAR(100),
    profile_image TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Seed default user
INSERT IGNORE INTO user_profiles (id, username) VALUES ('default', 'User');

SET FOREIGN_KEY_CHECKS = 1;
