const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

// Local database by default.
// Render will use /var/data when DB_PATH is configured.
const dbPath = process.env.DB_PATH ||
    path.join(__dirname, "students.db");

const directory = path.dirname(dbPath);

if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
}

const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
    CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        contact_number TEXT DEFAULT '',
        course TEXT NOT NULL,
        year_level TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Active',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
`);

module.exports = db;