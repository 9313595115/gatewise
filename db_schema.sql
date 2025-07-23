-- Create the database
-- CREATE DATABASE IF NOT EXISTS gatewise_db;
-- USE gatewise_db;
USE root6597_sms;


-- Users table with role support
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Staff management
CREATE TABLE staff (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    role ENUM('admin', 'manager', 'staff') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Helpdesk tickets
CREATE TABLE tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    priority ENUM('low', 'medium', 'high') NOT NULL,
    status ENUM('Open', 'In Progress', 'Resolved') NOT NULL DEFAULT 'Open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Delivery management
CREATE TABLE deliveries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    recipient_name VARCHAR(255) NOT NULL,
    package_details TEXT NOT NULL,
    expected_arrival DATE NOT NULL,
    status ENUM('Pending', 'Delivered', 'Returned') NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Directory contacts
CREATE TABLE directory_contacts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Visitor management
CREATE TABLE visitors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    visit_date DATETIME NOT NULL,
    meeting_with VARCHAR(100) NOT NULL,
    purpose VARCHAR(50) NOT NULL,
    status ENUM('Expected', 'Checked-In', 'Checked-Out') NOT NULL DEFAULT 'Expected',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Property management
CREATE TABLE properties (
    id INT AUTO_INCREMENT PRIMARY KEY,
    property_type VARCHAR(50) NOT NULL,
    owner_name VARCHAR(100) NOT NULL,
    contact_number VARCHAR(20) NOT NULL,
    description TEXT NOT NULL,
    status ENUM('Available', 'Sold', 'Rented') NOT NULL DEFAULT 'Available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Alerts system
CREATE TABLE alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    event_date DATE NOT NULL,
    priority ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notice board
CREATE TABLE notices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Create default admin user (Change password in production!)
INSERT INTO users (username, password, role) VALUES ('admin', 'admin123', 'admin');

-- Add indexes for better performance
ALTER TABLE users ADD INDEX idx_username (username);
ALTER TABLE staff ADD INDEX idx_email (email);
ALTER TABLE tickets ADD INDEX idx_status (status);
ALTER TABLE visitors ADD INDEX idx_visit_date (visit_date);
ALTER TABLE alerts ADD INDEX idx_event_date (event_date);
ALTER TABLE notices ADD INDEX idx_created_at (created_at); 