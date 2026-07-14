from models import get_db

def get_all_books():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM books ORDER BY title")
    books = cursor.fetchall()
    conn.close()
    return books

def get_book_by_id(book_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM books WHERE book_id = %s", (book_id,))
    book = cursor.fetchone()
    conn.close()
    return book

def search_books(query, search_by='title'):
    conn = get_db()
    cursor = conn.cursor()
    like_query = f"%{query}%"
    if search_by == 'title':
        cursor.execute("SELECT * FROM books WHERE title LIKE %s ORDER BY title", (like_query,))
    elif search_by == 'author':
        cursor.execute("SELECT * FROM books WHERE author LIKE %s ORDER BY title", (like_query,))
    elif search_by == 'category':
        cursor.execute("SELECT * FROM books WHERE category LIKE %s ORDER BY title", (like_query,))
    elif search_by == 'isbn':
        cursor.execute("SELECT * FROM books WHERE isbn LIKE %s ORDER BY title", (like_query,))
    else:
        cursor.execute("SELECT * FROM books WHERE title LIKE %s OR author LIKE %s OR category LIKE %s OR isbn LIKE %s ORDER BY title", (like_query, like_query, like_query, like_query))
    books = cursor.fetchall()
    conn.close()
    return books

def add_book(data):
    conn = get_db()
    cursor = conn.cursor()
    copies = data.get('total_copies', 1)
    cursor.execute("""
        INSERT INTO books (title, author, isbn, category, publisher, edition, total_copies, available_copies)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING book_id
    """, (
        data.get('title'),
        data.get('author'),
        data.get('isbn', ''),
        data.get('category', ''),
        data.get('publisher', ''),
        data.get('edition', ''),
        copies,
        copies
    ))
    result = cursor.fetchone()
    book_id = result['book_id'] if result else None
    conn.commit()
    conn.close()
    return book_id

def update_book(book_id, data):
    conn = get_db()
    cursor = conn.cursor()
    
    # Calculate available copies based on new total and current issues
    cursor.execute("SELECT COUNT(*) as count FROM issue_records WHERE book_id = %s AND status = 'issued'", (book_id,))
    issued_count = cursor.fetchone()['count']
    new_total = int(data.get('total_copies', 1))
    available_copies = max(0, new_total - issued_count)

    cursor.execute("""
        UPDATE books SET title=%s, author=%s, isbn=%s, category=%s,
        publisher=%s, edition=%s, total_copies=%s, available_copies=%s
        WHERE book_id=%s
    """, (
        data.get('title'),
        data.get('author'),
        data.get('isbn', ''),
        data.get('category', ''),
        data.get('publisher', ''),
        data.get('edition', ''),
        new_total,
        available_copies,
        book_id
    ))
    conn.commit()
    conn.close()
    return True

def delete_book(book_id):
    if not can_delete_book(book_id):
        return False, "Cannot delete book as there are active issues."
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM books WHERE book_id = %s", (book_id,))
    conn.commit()
    conn.close()
    return True, "Book deleted successfully"

def can_delete_book(book_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as count FROM issue_records WHERE book_id = %s AND status = 'issued'", (book_id,))
    result = cursor.fetchone()
    conn.close()
    return result['count'] == 0

def get_recent_books(limit=5):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM books ORDER BY added_date DESC LIMIT %s", (limit,))
    books = cursor.fetchall()
    conn.close()
    return books

def get_categories():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT category FROM books WHERE category IS NOT NULL AND category != '' ORDER BY category")
    categories = cursor.fetchall()
    conn.close()
    return [c['category'] for c in categories if c['category']]

def get_most_borrowed(limit=5):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT b.book_id, b.title, b.author, COUNT(ir.issue_id) as borrow_count
        FROM books b
        JOIN issue_records ir ON b.book_id = ir.book_id
        GROUP BY b.book_id
        ORDER BY borrow_count DESC
        LIMIT %s
    """, (limit,))
    books = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return books
