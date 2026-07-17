-- ============================================================
-- LibraVault — Library Management System Database Schema
-- SQLite Version
-- ============================================================

-- ─── Books Table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS books (
    book_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    isbn VARCHAR(20) UNIQUE,
    category VARCHAR(100) DEFAULT 'General',
    publisher VARCHAR(255) DEFAULT '',
    edition VARCHAR(50) DEFAULT '',
    total_copies INTEGER DEFAULT 1,
    available_copies INTEGER DEFAULT 1,
    added_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Members Table ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS members (
    member_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    roll_no VARCHAR(50) UNIQUE,
    department VARCHAR(100) DEFAULT '',
    year VARCHAR(20) DEFAULT '',
    contact VARCHAR(20) DEFAULT '',
    email VARCHAR(255) DEFAULT '',
    google_id VARCHAR(255) UNIQUE DEFAULT NULL,
    username VARCHAR(255) UNIQUE,
    password VARCHAR(255) NOT NULL DEFAULT '',
    role VARCHAR(20) DEFAULT 'student',
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Issue Records Table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS issue_records (
    issue_id SERIAL PRIMARY KEY,
    book_id INTEGER NOT NULL,
    member_id INTEGER NOT NULL,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    return_date DATE DEFAULT NULL,
    fine_amount DECIMAL(10,2) DEFAULT 0.00,
    fine_paid BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'issued',
    FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES members(member_id) ON DELETE CASCADE
);

-- ─── Messages Table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
    message_id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_read BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (member_id) REFERENCES members(member_id) ON DELETE CASCADE
);

-- ─── Indexes for Performance ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
CREATE INDEX IF NOT EXISTS idx_books_author ON books(author);
CREATE INDEX IF NOT EXISTS idx_books_category ON books(category);
CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn);
CREATE INDEX IF NOT EXISTS idx_members_roll_no ON members(roll_no);
CREATE INDEX IF NOT EXISTS idx_members_username ON members(username);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issue_records(status);
CREATE INDEX IF NOT EXISTS idx_issues_due_date ON issue_records(due_date);
CREATE INDEX IF NOT EXISTS idx_issues_book ON issue_records(book_id);
CREATE INDEX IF NOT EXISTS idx_issues_member ON issue_records(member_id);
CREATE INDEX IF NOT EXISTS idx_issues_member_status ON issue_records(member_id, status);
CREATE INDEX IF NOT EXISTS idx_issues_issue_date ON issue_records(issue_date);
CREATE INDEX IF NOT EXISTS idx_members_role_status ON members(role, status);
CREATE INDEX IF NOT EXISTS idx_issues_fine_paid ON issue_records(fine_paid);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Admin account (password: admin123)
INSERT INTO members (name, roll_no, department, username, password, role, status) VALUES
('Admin Librarian', 'ADMIN001', 'Library', 'admin',
 'pbkdf2:sha256:600000$salt$a1b2c3d4e5f6', 'admin', 'active');

-- Sample Students (password for all: student123)
INSERT INTO members (name, roll_no, department, year, contact, username, password, role, status) VALUES
('Arun Kumar', 'CS2024001', 'Computer Science', '3rd Year', '9876543210', 'arun', 'pbkdf2:sha256:600000$salt$a1b2c3d4e5f6', 'student', 'active'),
('Priya Sharma', 'EC2024002', 'Electronics', '2nd Year', '9876543211', 'priya', 'pbkdf2:sha256:600000$salt$a1b2c3d4e5f6', 'student', 'active'),
('Rahul Verma', 'ME2024003', 'Mechanical', '4th Year', '9876543212', 'rahul', 'pbkdf2:sha256:600000$salt$a1b2c3d4e5f6', 'student', 'active'),
('Sneha Patel', 'CS2024004', 'Computer Science', '2nd Year', '9876543213', 'sneha', 'pbkdf2:sha256:600000$salt$a1b2c3d4e5f6', 'student', 'active'),
('Vikram Singh', 'EE2024005', 'Electrical', '3rd Year', '9876543214', 'vikram', 'pbkdf2:sha256:600000$salt$a1b2c3d4e5f6', 'student', 'active'),
('Cloud Student', 'CS2024006', 'Cloud Computing', '1st Year', '9000000000', 'clouduser', 'pbkdf2:sha256:600000$salt$a1b2c3d4e5f6', 'student', 'active');

-- Sample Books
INSERT INTO books (title, author, isbn, category, publisher, edition, total_copies, available_copies) VALUES
('Introduction to Algorithms', 'Thomas H. Cormen', '978-0262033848', 'Computer Science', 'MIT Press', '3rd Edition', 5, 5),
('Clean Code', 'Robert C. Martin', '978-0132350884', 'Computer Science', 'Prentice Hall', '1st Edition', 3, 3),
('Design Patterns', 'Gang of Four', '978-0201633610', 'Computer Science', 'Addison-Wesley', '1st Edition', 2, 2),
('Database System Concepts', 'Abraham Silberschatz', '978-0078022159', 'Computer Science', 'McGraw-Hill', '7th Edition', 4, 4),
('Engineering Mathematics', 'B.S. Grewal', '978-8174091154', 'Mathematics', 'Khanna Publishers', '44th Edition', 6, 6),
('Higher Engineering Mathematics', 'H.K. Dass', '978-8121938907', 'Mathematics', 'S. Chand', '1st Edition', 3, 3),
('Physics for Engineers', 'R.K. Gaur', '978-8189866563', 'Physics', 'Dhanpat Rai', '2nd Edition', 4, 4),
('Fundamentals of Electric Circuits', 'Charles Alexander', '978-0078028229', 'Electronics', 'McGraw-Hill', '6th Edition', 3, 3),
('The C Programming Language', 'Brian Kernighan', '978-0131103627', 'Computer Science', 'Prentice Hall', '2nd Edition', 5, 5),
('Operating System Concepts', 'Abraham Silberschatz', '978-1118063330', 'Computer Science', 'Wiley', '9th Edition', 3, 3),
('Data Structures Using C', 'Reema Thareja', '978-0198099307', 'Computer Science', 'Oxford Press', '2nd Edition', 4, 4),
('Computer Networks', 'Andrew Tanenbaum', '978-0132126953', 'Computer Science', 'Pearson', '5th Edition', 3, 3),
('Strength of Materials', 'R.K. Rajput', '978-8121935470', 'Mechanical', 'S. Chand', '6th Edition', 2, 2),
('Fluid Mechanics', 'R.K. Bansal', '978-8131808153', 'Mechanical', 'Laxmi Publications', '9th Edition', 3, 3),
('Digital Electronics', 'Morris Mano', '978-0132774208', 'Electronics', 'Pearson', '5th Edition', 4, 4);
