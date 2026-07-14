"""
Book management routes — CRUD and search APIs.
"""

from flask import Blueprint, request, render_template, jsonify, session
from routes.auth import login_required, admin_required
from models import book as book_model
import config

books_bp = Blueprint('books', __name__)


@books_bp.route('/books')
@login_required
def books_page():
    """Render book catalog page."""
    categories = book_model.get_categories()
    return render_template('books.html',
                           app_name=config.APP_NAME,
                           categories=categories,
                           user_name=session.get('user_name'),
                           role=session.get('role'))


@books_bp.route('/api/books', methods=['GET'])
@login_required
def api_get_books():
    """API: Get all books or search."""
    query = request.args.get('q', '').strip()
    filter_by = request.args.get('filter', 'all')

    if query:
        books = book_model.search_books(query, filter_by)
    else:
        books = book_model.get_all_books()

    # Convert date objects to strings for JSON
    for b in books:
        if b.get('added_date') and hasattr(b['added_date'], 'strftime'):
            b['added_date'] = b['added_date'].strftime('%Y-%m-%d %H:%M:%S')

    return jsonify(books)


@books_bp.route('/api/books/<int:book_id>', methods=['GET'])
@login_required
def api_get_book(book_id):
    """API: Get a single book."""
    b = book_model.get_book(book_id)
    if not b:
        return jsonify({'error': 'Book not found'}), 404
    if b.get('added_date') and hasattr(b['added_date'], 'strftime'):
        b['added_date'] = b['added_date'].strftime('%Y-%m-%d %H:%M:%S')
    return jsonify(b)


@books_bp.route('/api/books', methods=['POST'])
@admin_required
def api_add_book():
    """API: Add a new book (admin only)."""
    data = request.get_json()
    if not data.get('title') or not data.get('author'):
        return jsonify({'error': 'Title and author are required'}), 400
    book_id = book_model.add_book(data)
    return jsonify({'success': True, 'book_id': book_id, 'message': 'Book added successfully'})


@books_bp.route('/api/books/<int:book_id>', methods=['PUT'])
@admin_required
def api_update_book(book_id):
    """API: Update a book (admin only)."""
    data = request.get_json()
    if not data.get('title') or not data.get('author'):
        return jsonify({'error': 'Title and author are required'}), 400
    book_model.update_book(book_id, data)
    return jsonify({'success': True, 'message': 'Book updated successfully'})


@books_bp.route('/api/books/<int:book_id>', methods=['DELETE'])
@admin_required
def api_delete_book(book_id):
    """API: Delete a book (admin only)."""
    success, message = book_model.delete_book(book_id)
    if not success:
        return jsonify({'error': message}), 400
    return jsonify({'success': True, 'message': message})


@books_bp.route('/api/books/categories', methods=['GET'])
@login_required
def api_get_categories():
    """API: Get all book categories."""
    return jsonify(book_model.get_categories())


@books_bp.route('/api/books/most-borrowed', methods=['GET'])
@login_required
def api_most_borrowed():
    """API: Get most borrowed books."""
    limit = request.args.get('limit', 10, type=int)
    books = book_model.get_most_borrowed(limit)
    for b in books:
        if b.get('added_date') and hasattr(b['added_date'], 'strftime'):
            b['added_date'] = b['added_date'].strftime('%Y-%m-%d %H:%M:%S')
    return jsonify(books)
