
require("dotenv").config();
const express = require("express");
const mysql = require("mysql");
const session = require("express-session");
const bodyParser = require("body-parser");
const cors = require('cors');
const path = require('path');
const PORT = process.env.PORT || 5001;

const app = express();

// Security middleware
app.use(cors({
    origin: '*',
    credentials: true
}));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(bodyParser.json());

// Session configuration
app.use(
    session({
        secret: process.env.SESSION_SECRET || "gatewise-secret-key",
        resave: false,
        saveUninitialized: false,
        cookie: { 
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
            sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        }
    })
);

// Database Connection
const db = mysql.createConnection({
    host: 'mysql-root6597.alwaysdata.net',
    user: 'root6597',
    password: 'YASHPY6597',
    database: 'root6597_sms',
    connectTimeout: 10000,
    waitForConnections: true,
    queueLimit: 0
});

// Handle database connection errors and reconnection
function handleDisconnect() {
    db.connect((err) => {
        if (err) {
            console.error("Error connecting to database:", err);
            setTimeout(handleDisconnect, 2000);
        } else {
            console.log("✅ Connected to AlwaysData MySQL!");
        }
    });

    db.on('error', (err) => {
        console.error('Database error:', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            handleDisconnect();
        } else {
            throw err;
        }
    });
}

handleDisconnect();

// Input validation middleware - MOVED HERE BEFORE ROUTES
const validateInput = (req, res, next) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
    }
    if (username.length < 3 || username.length > 50) {
        return res.status(400).json({ message: "Username must be between 3 and 50 characters" });
    }
    if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
    }
    next();
};

// Protected route middleware
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    next();
};

// Health check endpoint for Render
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// Register User
app.post("/register", validateInput, (req, res) => {
    const { username, password } = req.body;

    db.query("INSERT INTO users (username, password) VALUES (?, ?)", 
        [username, password], 
        (err) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ message: "Username already exists" });
                }
                return res.status(500).json({ message: "Database error" });
            }
            res.json({ success: true, message: "User registered successfully" });
        }
    );
});

// Login User
app.post("/login", validateInput, (req, res) => {
    const { username, password } = req.body;

    db.query("SELECT * FROM users WHERE username = ?", [username], (err, results) => {
        if (err) return res.status(500).json({ message: "Database error" });

        if (results.length === 0) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const user = results[0];

        if (password !== user.password) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        req.session.user = { 
            id: user.id, 
            username: user.username, 
            role: user.role 
        };
        
        res.json({ 
            success: true, 
            message: "Login successful",
            user: { 
                id: user.id, 
                username: user.username, 
                role: user.role 
            }
        });
    });
});

// Update Password (No Server Session)
app.post("/update-password", (req, res) => {
    const { username, currentPassword, newPassword } = req.body;

    db.query("SELECT password FROM users WHERE username = ?", [username], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: "Database error" });

        if (results.length === 0) return res.status(400).json({ success: false, message: "User not found" });

        if (currentPassword !== results[0].password) {
            return res.status(401).json({ success: false, message: "Current password is incorrect" });
        }

        db.query("UPDATE users SET password = ? WHERE username = ?", [newPassword, username], (err) => {
            if (err) return res.status(500).json({ success: false, message: "Error updating password" });

            res.json({ success: true, message: "Password updated successfully" });
        });
    });
});


app.get("/staff", (req, res) => {
    db.query("SELECT * FROM staff", (err, results) => {
        if (err) {
            console.error("Error fetching staff:", err);
            return res.status(500).json({ error: "Failed to fetch staff data" });
        }
        // console.log("Fetched staff data:", results);

        res.json(results);
    });
});


// Add Staff Endpoint
app.post("/add-staff", (req, res) => {
    const { name, email, phone, role } = req.body;

    // Validate input
    if (!name || !email || !phone || !role) {
        return res.status(400).json({ message: "All fields are required" });
    }

    // Insert into the database
    const query = "INSERT INTO staff (name, email, phone, role) VALUES (?, ?, ?, ?)";
    db.query(query, [name, email, phone, role], (err, results) => {
        if (err) {
            console.error("Error adding staff:", err);
            return res.status(500).json({ message: "Failed to add staff member" });
        }

        res.json({ message: "Staff member added successfully", id: results.insertId });
    });
});

app.delete("/remove-staff/:id", (req, res) => {
    const staffId = req.params.id;

    db.query("DELETE FROM staff WHERE id = ?", [staffId], (err, results) => {
        if (err) {
            console.error("Error removing staff:", err);
            return res.status(500).json({ message: "Error removing staff" });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({ message: "Staff member not found" });
        }

        res.json({ message: "Staff member removed successfully" });
    });
}); 


// Submit a New Ticket
app.post("/submit-ticket", (req, res) => {
    const { subject, description, priority } = req.body;
    const status = "Open"; // Default status for new tickets
    
    const query = "INSERT INTO tickets (subject, description, priority, status, created_at) VALUES (?, ?, ?, ?, NOW())";
    db.query(query, [subject, description, priority, status], (err, result) => {
        if (err) {
            console.error("Error inserting ticket: ", err);
            return res.status(500).json({ message: "Error submitting ticket" });
        }
        res.json({ message: "Ticket submitted successfully!" });
    });
});

// Get Ticket Counts (Open, In Progress, Resolved)
app.get("/ticket-counts", (req, res) => {
    const query = "SELECT status, COUNT(*) AS count FROM tickets GROUP BY status";
    db.query(query, (err, results) => {
        if (err) {
            console.error("Error fetching ticket counts: ", err);
            return res.status(500).json({ message: "Error fetching counts" });
        }
        const counts = { open: 0, in_progress: 0, resolved: 0 };
        results.forEach(row => {
            if (row.status === "Open") counts.open = row.count;
            if (row.status === "In Progress") counts.in_progress = row.count;
            if (row.status === "Resolved") counts.resolved = row.count;
        });
        res.json(counts);
    });
});

// Get Recent Tickets
app.get("/recent-tickets", (req, res) => {
    const query = "SELECT * FROM tickets ORDER BY created_at DESC LIMIT 10";
    db.query(query, (err, results) => {
        if (err) {
            console.error("Error fetching tickets: ", err);
            return res.status(500).json({ message: "Error fetching tickets" });
        }
        res.json(results);
    });
});

// Admin: Update Ticket Status
app.put("/update-ticket/:id", (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    const validStatuses = ["Open", "In Progress", "Resolved"];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
    }

    const query = "UPDATE tickets SET status = ? WHERE id = ?";
    db.query(query, [status, id], (err, result) => {
        if (err) {
            console.error("Error updating ticket: ", err);
            return res.status(500).json({ message: "Error updating ticket" });
        }
        res.json({ message: "Ticket status updated successfully!" });
    });
});
// Remove Ticket
app.delete("/remove-ticket/:id", (req, res) => {
    const { id } = req.params;

    const query = "DELETE FROM tickets WHERE id = ?";
    db.query(query, [id], (err, result) => {
        if (err) {
            console.error("Error removing ticket: ", err);
            return res.status(500).json({ message: "Error removing ticket" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Ticket not found" });
        }

        res.json({ message: "Ticket removed successfully!" });
    });
});


//visitor

// Visitor Management Endpoints - Updated with better error handling

// Get all visitors
app.get("/visitors", (req, res) => {
    db.query("SELECT * FROM visitors ORDER BY visit_date DESC", (err, results) => {
        if (err) {
            console.error("Database error fetching visitors:", err);
            return res.status(500).json({ 
                error: "Failed to fetch visitors",
                details: err.message 
            });
        }
        res.setHeader('Content-Type', 'application/json');
        res.json(results);
    });
});

// Add new visitor with enhanced validation
app.post("/add-visitor", (req, res) => {
    const { name, phone, visit_date, meeting_with, purpose } = req.body;
    
    // Validate input
    if (!name || !phone || !visit_date || !meeting_with || !purpose) {
        console.log("Validation failed - missing fields");
        return res.status(400).json({ 
            message: "All fields are required",
            received: req.body
        });
    }
    
    // Phone number validation
    if (!/^\d{10,15}$/.test(phone)) {
        console.log("Validation failed - invalid phone:", phone);
        return res.status(400).json({ 
            message: "Phone number must be 10-15 digits" 
        });
    }
    
    try {
        // Convert visit_date to MySQL compatible format
        const formattedDate = new Date(visit_date).toISOString().slice(0, 19).replace('T', ' ');
        
        const query = "INSERT INTO visitors (name, phone, visit_date, meeting_with, purpose) VALUES (?, ?, ?, ?, ?)";
        db.query(query, [name, phone, formattedDate, meeting_with, purpose], (err, results) => {
            if (err) {
                console.error("Database error adding visitor:", err);
                return res.status(500).json({ 
                    message: "Failed to add visitor",
                    error: err.message,
                    sql: err.sql
                });
            }
            
            console.log("Visitor added successfully:", results.insertId);
            res.json({ 
                success: true,
                message: "Visitor added successfully", 
                visitorId: results.insertId
            });
        });
    } catch (error) {
        console.error("Error processing visitor data:", error);
        res.status(500).json({ 
            message: "Error processing visitor data",
            error: error.message
        });
    }
});

// Remove visitor
app.delete("/remove-visitor/:id", (req, res) => {
    const visitorId = req.params.id;
    
    if (!visitorId || isNaN(visitorId)) {
        return res.status(400).json({ 
            message: "Invalid visitor ID",
            received: visitorId
        });
    }

    db.query("DELETE FROM visitors WHERE id = ?", [visitorId], (err, results) => {
        if (err) {
            console.error("Database error removing visitor:", err);
            return res.status(500).json({ 
                message: "Error removing visitor",
                error: err.message
            });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({ 
                message: "Visitor not found" 
            });
        }

        res.json({ 
            success: true,
            message: "Visitor removed successfully" 
        });
    });
});
// Get all deliveries
app.get("/deliveries", (req, res) => {
    db.query("SELECT * FROM deliveries", (err, results) => {
        if (err) {
            console.error("Error fetching deliveries:", err);
            return res.status(500).json({ error: "Failed to fetch deliveries" });
        }
        res.json(results);
    });
});

// Add new delivery
app.post("/add-delivery", (req, res) => {
    const { recipient_name, package_details, expected_arrival } = req.body;
    
    if (!recipient_name || !package_details || !expected_arrival) {
        return res.status(400).json({ message: "All fields are required" });
    }

    const query = "INSERT INTO deliveries (recipient_name, package_details, expected_arrival) VALUES (?, ?, ?)";
    db.query(query, [recipient_name, package_details, expected_arrival], (err, results) => {
        if (err) {
            console.error("Error adding delivery:", err);
            return res.status(500).json({ message: "Failed to add delivery" });
        }
        res.json({ 
            message: "Delivery added successfully", 
            delivery: {
                id: results.insertId,
                recipient_name,
                package_details,
                expected_arrival
            }
        });
    });
});

// Remove delivery
app.delete("/remove-delivery/:id", (req, res) => {
    const deliveryId = req.params.id;

    db.query("DELETE FROM deliveries WHERE id = ?", [deliveryId], (err, results) => {
        if (err) {
            console.error("Error removing delivery:", err);
            return res.status(500).json({ message: "Error removing delivery" });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({ message: "Delivery not found" });
        }

        res.json({ message: "Delivery removed successfully" });
    });
});


// Get all directory contacts
app.get("/directory-contacts", (req, res) => {
    db.query("SELECT * FROM directory_contacts", (err, results) => {
        if (err) {
            console.error("Error fetching contacts:", err);
            return res.status(500).json({ message: "Failed to fetch contacts" });
        }
        res.json(results);
    });
});

// Add a new directory contact
app.post("/add-directory-contact", (req, res) => {
    const { name, role, phone, email } = req.body;
    if (!name || !role || !phone || !email) {
        return res.status(400).json({ message: "All fields are required" });
    }

    db.query(
        "INSERT INTO directory_contacts (name, role, phone, email) VALUES (?, ?, ?, ?)",
        [name, role, phone, email],
        (err, result) => {
            if (err) {
                console.error("Error adding contact:", err);
                return res.status(500).json({ message: "Failed to add contact" });
            }
            res.json({ message: "Contact added successfully!" });
        }
    );
});

// Remove a contact
app.delete("/remove-directory-contact/:id", (req, res) => {
    const id = req.params.id;
    db.query("DELETE FROM directory_contacts WHERE id = ?", [id], (err, result) => {
        if (err) {
            console.error("Error deleting contact:", err);
            return res.status(500).json({ message: "Failed to delete contact" });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Contact not found" });
        }
        res.json({ message: "Contact deleted successfully!" });
    });
});


// Add these property-related endpoints to your existing server.js

// Property Management Endpoints

// Get all properties
app.get("/properties", (req, res) => {
    db.query("SELECT * FROM properties", (err, results) => {
        if (err) {
            console.error("Error fetching properties:", err);
            return res.status(500).json({ error: "Failed to fetch properties" });
        }
        res.json(results);
    });
});

// Add new property
app.post("/add-property", (req, res) => {
    const { propertyType, ownerName, contactNumber, propertyDescription } = req.body;
    
    if (!propertyType || !ownerName || !contactNumber || !propertyDescription) {
        return res.status(400).json({ message: "All fields are required" });
    }

    const query = "INSERT INTO properties (property_type, owner_name, contact_number, description) VALUES (?, ?, ?, ?)";
    db.query(query, [propertyType, ownerName, contactNumber, propertyDescription], (err, results) => {
        if (err) {
            console.error("Error adding property:", err);
            return res.status(500).json({ message: "Failed to add property" });
        }
        res.json({ 
            message: "Property added successfully", 
            property: {
                id: results.insertId,
                property_type: propertyType,
                owner_name: ownerName,
                contact_number: contactNumber,
                description: propertyDescription
            }
        });
    });
});

// Remove property
app.delete("/remove-property/:id", (req, res) => {
    const propertyId = req.params.id;

    db.query("DELETE FROM properties WHERE id = ?", [propertyId], (err, results) => {
        if (err) {
            console.error("Error removing property:", err);
            return res.status(500).json({ message: "Error removing property" });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({ message: "Property not found" });
        }

        res.json({ message: "Property removed successfully" });
    });
});

// Get all alerts (sorted by date)
app.get("/alerts", (req, res) => {
    const query = `
        SELECT 
            id,
            event_name AS eventName,
            description AS eventDescription,
            DATE_FORMAT(event_date, '%Y-%m-%d') AS eventDate 
        FROM alerts 
        ORDER BY event_date DESC
    `;
    
    db.query(query, (err, results) => {
        if (err) {
            console.error("Error fetching alerts:", err);
            return res.status(500).json({ error: "Failed to fetch alerts" });
        }
        res.json(results);
    });
});

app.post("/add-alert", (req, res) => {
    const { eventName, eventDescription, eventDate } = req.body;
    
    if (!eventName || !eventDescription || !eventDate) {
        return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const query = `
        INSERT INTO alerts 
            (event_name, description, event_date) 
        VALUES 
            (?, ?, ?)
    `;
    
    db.query(query, [eventName, eventDescription, eventDate], (err, results) => {
        if (err) {
            console.error("Error adding alert:", err);
            return res.status(500).json({ 
                success: false,
                message: "Failed to add alert",
                error: err.message
            });
        }
        
        res.json({ 
            success: true,
            message: "Alert added successfully",
            alertId: results.insertId
        });
    });
});

// Remove alert endpoint
app.delete("/remove-alert/:id", (req, res) => {
    const alertId = req.params.id;
    
    if (!alertId || isNaN(alertId)) {
        return res.status(400).json({ success: false, message: "Invalid alert ID" });
    }

    db.query("DELETE FROM alerts WHERE id = ?", [alertId], (err, results) => {
        if (err) {
            console.error("Error removing alert:", err);
            return res.status(500).json({ 
                success: false,
                message: "Error removing alert",
                error: err.message
            });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Alert not found" });
        }

        res.json({ 
            success: true,
            message: "Alert removed successfully" 
        });
    });
});





// // Get all notices
// app.get("/notices", (req, res) => {
//     db.query("SELECT * FROM notices ORDER BY created_at DESC", (err, results) => {
//         if (err) {
//             console.error('MySQL Error fetching notices:', err);
//             return res.status(500).json({ 
//                 success: false,
//                 error: 'Database error',
//                 message: 'Failed to fetch notices'
//             });
//         }
//         res.json({ success: true, notices: results });
//     });
// });

// // Add new notice (admin only)
// app.post("/add-notice", (req, res) => {
//     try {
//         const { username, title, content } = req.body;
        
//         // Validate input
//         if (!username || !title || !content) {
//             return res.status(400).json({ 
//                 success: false,
//                 error: 'Missing fields',
//                 message: 'Username, title and content are required'
//             });
//         }

//         // Check admin status
//         if (username !== "admin") {
//             return res.status(403).json({ 
//                 success: false,
//                 error: 'Unauthorized',
//                 message: 'Only admin can add notices'
//             });
//         }

//         // Insert into database
//         const query = "INSERT INTO notices (title, content, created_at) VALUES (?, ?, NOW())";
//         db.query(query, [title, content], (err, result) => {
//             if (err) {
//                 console.error('MySQL Error adding notice:', err);
//                 return res.status(500).json({ 
//                     success: false,
//                     error: 'Database error',
//                     message: 'Failed to add notice to database'
//                 });
//             }
            
//             res.json({ 
//                 success: true,
//                 message: "Notice added successfully",
//                 noticeId: result.insertId
//             });
//         });
//     } catch (error) {
//         console.error('Server Error in add-notice:', error);
//         res.status(500).json({
//             success: false,
//             error: 'Server error',
//             message: 'Internal server error while processing notice'
//         });
//     }
// });

// // Remove notice (admin only)
// app.delete("/remove-notice/:id", (req, res) => {
//     try {
//         const noticeId = req.params.id;
//         const { username } = req.body;
        
//         // Validate input
//         if (!username) {
//             return res.status(400).json({ 
//                 success: false,
//                 error: 'Missing username',
//                 message: 'Username is required'
//             });
//         }

//         // Check admin status
//         if (username !== "admin") {
//             return res.status(403).json({ 
//                 success: false,
//                 error: 'Unauthorized',
//                 message: 'Only admin can remove notices'
//             });
//         }

//         // Delete from database
//         db.query("DELETE FROM notices WHERE id = ?", [noticeId], (err, result) => {
//             if (err) {
//                 console.error('MySQL Error removing notice:', err);
//                 return res.status(500).json({ 
//                     success: false,
//                     error: 'Database error',
//                     message: 'Failed to remove notice from database'
//                 });
//             }
            
//             if (result.affectedRows === 0) {
//                 return res.status(404).json({ 
//                     success: false,
//                     error: 'Not found',
//                     message: 'Notice not found'
//                 });
//             }
            
//             res.json({ 
//                 success: true,
//                 message: "Notice removed successfully"
//             });
//         });
//     } catch (error) {
//         console.error('Server Error in remove-notice:', error);
//         res.status(500).json({
//             success: false,
//             error: 'Server error',
//             message: 'Internal server error while removing notice'
//         });
//     }
// });

// // Check if user is admin
// app.post("/check-admin", (req, res) => {
//     try {
//         const { username } = req.body;
        
//         if (!username) {
//             return res.status(400).json({ 
//                 success: false,
//                 error: 'Missing username',
//                 message: 'Username is required'
//             });
//         }
        
//         res.json({ 
//             success: true,
//             isAdmin: username === "admin"
//         });
//     } catch (error) {
//         console.error('Server Error in check-admin:', error);
//         res.status(500).json({
//             success: false,
//             error: 'Server error',
//             message: 'Internal server error while checking admin status'
//         });
//     }
// });




// Get all notices
app.get("/notices", (req, res) => {
    db.query("SELECT * FROM notices ORDER BY created_at DESC", (err, results) => {
        if (err) {
            console.error("Error fetching notices:", err);
            return res.status(500).json({ error: "Failed to fetch notices" });
        }
        res.json(results);
    });
});

// Add new notice (admin only)
app.post("/add-notice", (req, res) => {
    const { username, title, content } = req.body;

    if (!username || !title || !content) {
        return res.status(400).json({ message: "Username, title and content are required" });
    }

    if (username !== "admin") {
        return res.status(403).json({ message: "Only admin can add notices" });
    }

    const query = "INSERT INTO notices (title, content, created_at) VALUES (?, ?, NOW())";
    db.query(query, [title, content], (err, results) => {
        if (err) {
            console.error("Error adding notice:", err);
            return res.status(500).json({ message: "Failed to add notice" });
        }
        res.json({ 
            success: true,
            message: "Notice added successfully", 
            noticeId: results.insertId
        });
    });
});

// Remove notice (admin only)
app.delete("/remove-notice/:id", (req, res) => {
    const noticeId = req.params.id;
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ message: "Username is required" });
    }

    if (username !== "admin") {
        return res.status(403).json({ message: "Only admin can remove notices" });
    }

    db.query("DELETE FROM notices WHERE id = ?", [noticeId], (err, results) => {
        if (err) {
            console.error("Error removing notice:", err);
            return res.status(500).json({ message: "Error removing notice" });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({ message: "Notice not found" });
        }

        res.json({ success: true, message: "Notice removed successfully" });
    });
});


// Error handling for 404



// Error handling for 500
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// Start Server with error handling
const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
}).on('error', (err) => {
    console.error('Server failed to start:', err);
});
// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('Received SIGTERM. Performing graceful shutdown...');
    server.close(() => {
        console.log('Server closed. Disconnecting from database...');
        db.end(() => {
            console.log('Database connection closed.');
            process.exit(0);
        });
    });
});

