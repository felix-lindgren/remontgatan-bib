// Configuration
/* const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : window.API_BASE_URL || 'http://localhost:8000'; */
const API_BASE_URL = 'https://api-bibliotek.felix-lindgren.se';
// State management
let currentBooks = [];
let librisResults = [];
let currentPage = 1;
const booksPerPage = 20;
let currentEditingBookId = null;
let currentDeletingBookId = null;



// Utility Functions
async function apiFetch(url, opts = {}) {
  return fetch(url, { credentials: 'include', ...opts });
}

// Call a protected endpoint; if 401 → top-level redirect to CF login
async function ensureAccess() {
  const r = await apiFetch(`${API_BASE_URL}/api/books/count`); // any protected GET
  if (r.ok) return true;
  if (r.status === 401) {
    window.location.href =
      `${API_BASE_URL}/cdn-cgi/access/login?redirect_url=${encodeURIComponent(window.location.href)}`;
    return false;
  }
  return true; // other errors: let UI handle
}

function showLoading(message = 'Laddar...') {
    const overlay = document.getElementById('loading-overlay');
    overlay.querySelector('p').textContent = message;
    overlay.style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loading-overlay').style.display = 'none';
}

function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    container.appendChild(notification);

    // Trigger animation
    setTimeout(() => notification.classList.add('show'), 10);

    // Remove after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => container.removeChild(notification), 300);
    }, 3000);
}

function showDialog(dialogId) {
    document.getElementById(dialogId).style.display = 'flex';
}

function hideDialog(dialogId) {
    document.getElementById(dialogId).style.display = 'none';
}

// API Functions
async function fetchBooks() {
    try {
        const response = await apiFetch(`${API_BASE_URL}/api/books?limit=500`);
        if (!response.ok) throw new Error('Failed to fetch books');
        const books = await response.json();
        currentBooks = books;
        currentPage = 1; // Reset to first page
        renderBookTable();
        updateBookCount();
    } catch (error) {
        console.error('Error fetching books:', error);
        showNotification('Kunde inte hämta böcker', 'error');
    }
}

async function searchBooks(term) {
    try {
        showLoading('Söker...');
        const response = await apiFetch(`${API_BASE_URL}/api/books/search?q=${encodeURIComponent(term)}`);
        if (!response.ok) throw new Error('Search failed');
        const books = await response.json();
        currentBooks = books;
        currentPage = 1; // Reset to first page
        renderBookTable();
        hideLoading();
        if (books.length === 0) {
            showNotification('Inga böcker hittades', 'warning');
        }
    } catch (error) {
        console.error('Error searching books:', error);
        showNotification('Sökning misslyckades', 'error');
        hideLoading();
    }
}

async function searchByCategory(category) {
    try {
        showLoading('Söker kategori...');
        const response = await apiFetch(`${API_BASE_URL}/api/books/category/${encodeURIComponent(category)}`);
        if (!response.ok) throw new Error('Category search failed');
        const books = await response.json();
        currentBooks = books;
        currentPage = 1; // Reset to first page
        renderBookTable();
        hideLoading();
        if (books.length === 0) {
            showNotification('Inga böcker hittades i kategorin', 'warning');
        }
    } catch (error) {
        console.error('Error searching category:', error);
        showNotification('Kategorisökning misslyckades', 'error');
        hideLoading();
    }
}

async function addBook(bookData) {
    try {
        showLoading('Lägger till bok...');
        const response = await apiFetch(`${API_BASE_URL}/api/books`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(bookData)
        });

        if (response.status === 409) {
            showNotification('Boken finns redan i databasen', 'error');
            hideLoading();
            return false;
        }

        if (!response.ok) throw new Error('Failed to add book');

        showNotification('Bok tillagd!', 'success');
        await fetchBooks();
        hideLoading();
        return true;
    } catch (error) {
        console.error('Error adding book:', error);
        showNotification('Kunde inte lägga till bok', 'error');
        hideLoading();
        return false;
    }
}

async function updateBook(bookId, updates) {
    try {
        showLoading('Uppdaterar bok...');
        const response = await apiFetch(`${API_BASE_URL}/api/books/${encodeURIComponent(bookId)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updates)
        });

        if (!response.ok) throw new Error('Failed to update book');

        showNotification('Bok uppdaterad', 'success');
        await fetchBooks();
        hideLoading();
        return true;
    } catch (error) {
        console.error('Error updating book:', error);
        showNotification('Kunde inte uppdatera bok', 'error');
        hideLoading();
        return false;
    }
}

async function deleteBook(bookId) {
    try {
        showLoading('Tar bort bok...');
        const response = await apiFetch(`${API_BASE_URL}/api/books/${encodeURIComponent(bookId)}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete book');

        showNotification('Bok borttagen', 'success');
        await fetchBooks();
        hideLoading();
        return true;
    } catch (error) {
        console.error('Error deleting book:', error);
        showNotification('Kunde inte ta bort bok', 'error');
        hideLoading();
        return false;
    }
}

async function searchLibris(term) {
    try {
        showLoading('Hämtar från Libris...');
        const url = "https://api.libris.kb.se/xsearch";
        const response = await fetch(`${url}?query=${encodeURIComponent(term)}&format=json&format_level=full`);

        if (!response.ok) {
            throw new Error('Libris API request failed');
        }

        const data = await response.json();

        // Get up to 5 results
        const bookList = data.xsearch.list;
        const results = [];

        for (let i = 0; i < Math.min(5, bookList.length); i++) {
            const book = bookList[i];
            try {
                const res = {
                    id: book.identifier.substring(24),
                    title: book.title
                };

                // ISBN
                try {
                    const isbn = book.isbn;
                    if (Array.isArray(isbn)) {
                        res.isbn = isbn.length > 0 ? isbn[0] : "Saknas";
                    } else {
                        res.isbn = isbn || "Saknas";
                    }
                } catch (e) {
                    console.log("Saknas ISBN");
                    res.isbn = "Saknas";
                }

                // Author
                let auth = book.creator;
                if (Array.isArray(auth) && auth.length > 1) {
                    auth = auth.join(', ');
                } else if (Array.isArray(auth)) {
                    auth = auth[0];
                }
                res.author = auth;

                // SAB classification
                let sab = "Saknas";
                try {
                    sab = book.classification.sab[0].split(" ")[0];
                } catch (e) {
                    console.log("Saknas SAB för " + res.title);
                }
                res.sab = sab;
                res.shelf = sab;

                // Subject
                let subj = "Saknas";
                try {
                    subj = book.subject;
                    if (Array.isArray(subj)) {
                        if (subj.length > 1) {
                            subj = subj.join(" ");
                        } else {
                            subj = subj[0];
                        }
                    }
                } catch (e) {
                    console.log("Saknas ämnesord");
                }
                res.subject = subj;

                results.push(res);
            } catch (e) {
                console.error(`Error parsing book ${i}:`, e);
                continue;
            }
        }

        if (results.length === 0) {
            showNotification('Kunde inte hämta bok från Libris', 'error');
            librisResults = [];
            hideLoading();
            return null;
        }

        librisResults = results;
        hideLoading();
        showNotification(`${results.length} böcker hämtade från Libris`, 'success');
        return results;
    } catch (error) {
        console.error('Error searching Libris:', error);
        showNotification('Kunde inte hämta från Libris', 'error');
        librisResults = [];
        hideLoading();
        return null;
    }
}

async function exportBooks(searchTerm = '***') {
    try {
        showLoading('Exporterar...');
        const response = await apiFetch(`${API_BASE_URL}/api/books/export?search=${encodeURIComponent(searchTerm)}`);
        if (!response.ok) throw new Error('Export failed');
        const data = await response.json();
        hideLoading();
        return data.content;
    } catch (error) {
        console.error('Error exporting books:', error);
        showNotification('Export misslyckades', 'error');
        hideLoading();
        return null;
    }
}

async function updateBookCount() {
    try {
        const response = await apiFetch(`${API_BASE_URL}/api/books/count`);
        if (!response.ok) throw new Error('Failed to get count');
        const data = await response.json();
        document.getElementById('book-count-label').textContent = `Antal: ${data.count}`;
    } catch (error) {
        console.error('Error getting book count:', error);
        document.getElementById('book-count-label').textContent = 'Antal: 0';
    }
}

// UI Functions
function renderBookTable() {
    const tbody = document.getElementById('books-tbody');
    tbody.innerHTML = '';

    // Calculate pagination
    const startIndex = (currentPage - 1) * booksPerPage;
    const endIndex = Math.min(startIndex + booksPerPage, currentBooks.length);
    const pageBooks = currentBooks.slice(startIndex, endIndex);

    if (pageBooks.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="5" style="text-align: center;">Inga böcker att visa</td>';
        tbody.appendChild(tr);
        updatePaginationControls();
        return;
    }

    pageBooks.forEach(book => {
        const tr = document.createElement('tr');
        tr.dataset.bookId = book.id;

        tr.innerHTML = `
            <td>${escapeHtml(book.title || '')}</td>
            <td>${escapeHtml(book.author || '')}</td>
            <td>${escapeHtml(book.shelf || '')}</td>
            <td>${escapeHtml(book.other || '')}</td>
            <td class="actions-cell">
                <button class="btn-icon btn-edit" onclick="openEditDialog('${escapeHtml(book.id)}')">✏️</button>
                <button class="btn-icon btn-delete" onclick="openDeleteDialog('${escapeHtml(book.id)}')">🗑️</button>
                <a href="http://libris.kb.se/bib/${escapeHtml(book.id)}" target="_blank" class="btn-icon">🔗</a>
            </td>
        `;

        tbody.appendChild(tr);
    });

    updatePaginationControls();
}

function updatePaginationControls() {
    const totalPages = Math.ceil(currentBooks.length / booksPerPage);
    const pageInfo = document.getElementById('page-info');
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');

    pageInfo.textContent = `Sida ${currentPage} av ${totalPages || 1} (${currentBooks.length} böcker)`;
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function renderLibrisResults(results) {
    const container = document.getElementById('libris-results');
    const containerDiv = document.getElementById('libris-results-container');

    if (!results || results.length === 0) {
        containerDiv.style.display = 'none';
        return;
    }

    container.innerHTML = '';
    results.forEach((result, index) => {
        const div = document.createElement('div');
        div.className = 'libris-result-item';
        if (index === 0) div.classList.add('selected');
        div.dataset.index = index;
        div.textContent = result.title;
        div.onclick = () => selectLibrisResult(index);
        container.appendChild(div);
    });

    containerDiv.style.display = 'block';
    selectLibrisResult(0);
}

function selectLibrisResult(index) {
    if (!librisResults || index >= librisResults.length) return;

    // Update selected styling
    document.querySelectorAll('.libris-result-item').forEach((item, i) => {
        if (i === index) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });

    // Populate form
    const result = librisResults[index];
    document.getElementById('title-input').value = result.title || '';
    document.getElementById('author-input').value = result.author || '';
    document.getElementById('isbn-input').value = result.isbn || '';
    document.getElementById('sab-input').value = result.sab || '';
    document.getElementById('shelf-input').value = result.shelf || '';
    document.getElementById('subject-input').value = result.subject || '';
    document.getElementById('book-id-input').value = result.id || '';
}

function clearForm() {
    document.getElementById('libris-search').value = '';
    document.getElementById('title-input').value = '';
    document.getElementById('author-input').value = '';
    document.getElementById('isbn-input').value = '';
    document.getElementById('sab-input').value = '';
    document.getElementById('shelf-input').value = '';
    document.getElementById('subject-input').value = '';
    document.getElementById('book-id-input').value = '';
    document.getElementById('libris-results-container').style.display = 'none';
    librisResults = [];
}

// Dialog Functions
function openEditDialog(bookId) {
    const book = currentBooks.find(b => b.id === bookId);
    if (!book) return;

    currentEditingBookId = bookId;
    document.getElementById('edit-title').value = book.title || '';
    document.getElementById('edit-author').value = book.author || '';
    document.getElementById('edit-shelf').value = book.shelf || '';
    document.getElementById('edit-other').value = book.other || '';

    showDialog('edit-dialog');
}

function openDeleteDialog(bookId) {
    const book = currentBooks.find(b => b.id === bookId);
    if (!book) return;

    currentDeletingBookId = bookId;
    document.getElementById('delete-book-info').textContent =
        `${book.title} av ${book.author}`;

    showDialog('delete-dialog');
}

function downloadTextFile(filename, content) {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

// Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
    await ensureAccess();
    // Initial load
    fetchBooks();

    // Search functionality
    document.getElementById('search-btn').addEventListener('click', () => {
        const term = document.getElementById('search-input').value.trim();
        if (term) {
            searchBooks(term);
        } else {
            fetchBooks();
        }
    });

    document.getElementById('search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const term = e.target.value.trim();
            if (term) {
                searchBooks(term);
            } else {
                fetchBooks();
            }
        }
    });

    // Category search
    document.getElementById('category-btn').addEventListener('click', () => {
        const category = document.getElementById('category-input').value.trim();
        if (category) {
            searchByCategory(category);
        }
    });

    document.getElementById('category-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const category = e.target.value.trim();
            if (category) {
                searchByCategory(category);
            }
        }
    });

    // Show all books
    document.getElementById('show-all-btn').addEventListener('click', () => {
        document.getElementById('search-input').value = '';
        document.getElementById('category-input').value = '';
        currentPage = 1;
        fetchBooks();
    });

    // Libris search
    document.getElementById('libris-search-btn').addEventListener('click', async () => {
        const term = document.getElementById('libris-search').value.trim();
        if (!term) {
            showNotification('Ange ett sökord', 'warning');
            return;
        }

        const results = await searchLibris(term);
        if (results) {
            renderLibrisResults(results);
        }
    });

    document.getElementById('libris-search').addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            const term = e.target.value.trim();
            if (!term) {
                showNotification('Ange ett sökord', 'warning');
                return;
            }

            const results = await searchLibris(term);
            if (results) {
                renderLibrisResults(results);
            }
        }
    });

    // Add book
    document.getElementById('add-book-btn').addEventListener('click', async () => {
        const bookData = {
            id: document.getElementById('book-id-input').value.trim(),
            title: document.getElementById('title-input').value.trim(),
            author: document.getElementById('author-input').value.trim(),
            isbn: document.getElementById('isbn-input').value.trim(),
            sab: document.getElementById('sab-input').value.trim(),
            shelf: document.getElementById('shelf-input').value.trim(),
            subject: document.getElementById('subject-input').value.trim(),
            other: 'Ingen kommentar'
        };

        if (!bookData.id || !bookData.title || !bookData.author) {
            showNotification('Fyll i ID, titel och författare', 'warning');
            return;
        }

        const success = await addBook(bookData);
        if (success) {
            clearForm();
        }
    });

    // Clear form
    document.getElementById('clear-form-btn').addEventListener('click', clearForm);

    // Pagination
    document.getElementById('prev-page').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderBookTable();
        }
    });

    document.getElementById('next-page').addEventListener('click', () => {
        const totalPages = Math.ceil(currentBooks.length / booksPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderBookTable();
        }
    });

    // Edit dialog
    document.getElementById('save-edit-btn').addEventListener('click', async () => {
        if (!currentEditingBookId) return;

        const updates = {
            title: document.getElementById('edit-title').value.trim(),
            author: document.getElementById('edit-author').value.trim(),
            shelf: document.getElementById('edit-shelf').value.trim(),
            other: document.getElementById('edit-other').value.trim()
        };

        const success = await updateBook(currentEditingBookId, updates);
        if (success) {
            hideDialog('edit-dialog');
            currentEditingBookId = null;
        }
    });

    document.getElementById('cancel-edit-btn').addEventListener('click', () => {
        hideDialog('edit-dialog');
        currentEditingBookId = null;
    });

    // Delete dialog
    document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
        if (!currentDeletingBookId) return;

        const success = await deleteBook(currentDeletingBookId);
        if (success) {
            hideDialog('delete-dialog');
            currentDeletingBookId = null;
        }
    });

    document.getElementById('cancel-delete-btn').addEventListener('click', () => {
        hideDialog('delete-dialog');
        currentDeletingBookId = null;
    });

    // Export dialog
    document.getElementById('export-btn').addEventListener('click', () => {
        showDialog('export-dialog');
        document.getElementById('export-result').value = '';
        document.getElementById('download-export-btn').style.display = 'none';
    });

    document.getElementById('do-export-btn').addEventListener('click', async () => {
        const searchTerm = document.getElementById('export-search').value.trim() || '***';
        const content = await exportBooks(searchTerm);
        if (content) {
            document.getElementById('export-result').value = content;
            document.getElementById('download-export-btn').style.display = 'inline-block';
        }
    });

    document.getElementById('download-export-btn').addEventListener('click', () => {
        const content = document.getElementById('export-result').value;
        const searchTerm = document.getElementById('export-search').value.trim() || 'alla';
        downloadTextFile(`${searchTerm}-bocker.txt`, content);
    });

    document.getElementById('close-export-btn').addEventListener('click', () => {
        hideDialog('export-dialog');
    });

    // Close dialogs on overlay click
    document.querySelectorAll('.dialog-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.style.display = 'none';
            }
        });
    });
});
