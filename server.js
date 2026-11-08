require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const db = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the frontend
app.use(express.static(path.join(__dirname, "public")));

const getStudents = db.prepare(`
    SELECT * FROM students ORDER BY id DESC
`);

const getStudent = db.prepare(`
    SELECT * FROM students WHERE id = ?
`);

const insertStudent = db.prepare(`
    INSERT INTO students
    (first_name, last_name, email, contact_number,
     course, year_level, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const updateStudent = db.prepare(`
    UPDATE students
    SET first_name = ?,
        last_name = ?,
        email = ?,
        contact_number = ?,
        course = ?,
        year_level = ?,
        status = ?
    WHERE id = ?
`);

const deleteStudent = db.prepare(`
    DELETE FROM students WHERE id = ?
`);

function validateStudent(data) {
    const fields = [
        "first_name",
        "last_name",
        "email",
        "course",
        "year_level"
    ];

    for (const field of fields) {
        if (!data[field] || !String(data[field]).trim()) {
            return `${field.replace("_", " ")} is required.`;
        }
    }

    const email = String(data.email).trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return "Please enter a valid email address.";
    }

    if (data.status && !["Active", "Inactive"].includes(data.status)) {
        return "Invalid student status.";
    }

    return null;
}

// GET ALL STUDENTS
app.get("/api/students", (req, res) => {
    try {
        res.json(getStudents.all());
    } catch (error) {
        res.status(500).json({ error: "Unable to retrieve students." });
    }
});

// GET ONE STUDENT
app.get("/api/students/:id", (req, res) => {
    const student = getStudent.get(Number(req.params.id));

    if (!student) {
        return res.status(404).json({ error: "Student not found." });
    }

    res.json(student);
});

// DASHBOARD STATISTICS
app.get("/api/stats", (req, res) => {
    try {
        const stats = db.prepare(`
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) AS active,
                SUM(CASE WHEN status = 'Inactive' THEN 1 ELSE 0 END) AS inactive
            FROM students
        `).get();

        res.json({
            total: stats.total || 0,
            active: stats.active || 0,
            inactive: stats.inactive || 0
        });
    } catch (error) {
        res.status(500).json({ error: "Unable to load statistics." });
    }
});

// ADD STUDENT
app.post("/api/students", (req, res) => {
    const data = req.body;
    const error = validateStudent(data);

    if (error) {
        return res.status(400).json({ error });
    }

    try {
        const result = insertStudent.run(
            data.first_name.trim(),
            data.last_name.trim(),
            data.email.trim().toLowerCase(),
            (data.contact_number || "").trim(),
            data.course.trim(),
            data.year_level.trim(),
            data.status || "Active"
        );

        res.status(201).json({
            message: "Student added successfully!",
            student: getStudent.get(result.lastInsertRowid)
        });
    } catch (error) {
        if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
            return res.status(409).json({
                error: "This email address is already registered."
            });
        }

        res.status(500).json({ error: "Failed to add student." });
    }
});

// UPDATE STUDENT
app.put("/api/students/:id", (req, res) => {
    const id = Number(req.params.id);
    const error = validateStudent(req.body);

    if (error) {
        return res.status(400).json({ error });
    }

    if (!Number.isInteger(id) || id < 1 || !getStudent.get(id)) {
        return res.status(404).json({ error: "Student not found." });
    }

    const data = req.body;

    try {
        updateStudent.run(
            data.first_name.trim(),
            data.last_name.trim(),
            data.email.trim().toLowerCase(),
            (data.contact_number || "").trim(),
            data.course.trim(),
            data.year_level.trim(),
            data.status || "Active",
            id
        );

        res.json({
            message: "Student updated successfully!",
            student: getStudent.get(id)
        });
    } catch (error) {
        if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
            return res.status(409).json({
                error: "This email address is already registered."
            });
        }

        res.status(500).json({ error: "Failed to update student." });
    }
});

// DELETE STUDENT
app.delete("/api/students/:id", (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({ error: "Invalid student ID." });
    }

    const result = deleteStudent.run(id);

    if (!result.changes) {
        return res.status(404).json({ error: "Student not found." });
    }

    res.json({ message: "Student deleted successfully!" });
});

// HEALTH CHECK
app.get("/api/health", (req, res) => {
    res.json({ status: "OK", message: "StudentHub API is running." });
});

// SPA fallback
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`StudentHub running on port ${PORT}`);
});