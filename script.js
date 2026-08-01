/* ============================================================
   WEB WORLD SERVICES — MAIN SCRIPT
   ------------------------------------------------------------
   This one file is shared by every page. Each section below
   checks that its elements exist before running, so nothing
   breaks on pages that don't have that element (for example,
   the admin login code only runs on admin.html).

   Sections:
   1. Mobile menu (hamburger)
   2. Scroll-reveal animation
   3. Admin login (admin.html only)
   4. Contact form (contact.html only)
   ============================================================ */


/* ----------------------------------------------------------
   1. MOBILE MENU
   ---------------------------------------------------------- */
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');

if (hamburger && navLinks) {
  hamburger.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('active');
    hamburger.classList.toggle('active');
    hamburger.setAttribute('aria-expanded', isOpen);
  });

  // Close the menu when a link is tapped (nice on mobile)
  navLinks.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('active');
      hamburger.classList.remove('active');
      hamburger.setAttribute('aria-expanded', false);
    });
  });
}


/* ----------------------------------------------------------
   2. SCROLL-REVEAL ANIMATION
   Any element with class="reveal" fades and rises into view
   the first time it scrolls into the viewport.
   ---------------------------------------------------------- */
const revealElements = document.querySelectorAll('.reveal');

if (revealElements.length > 0) {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
          observer.unobserve(entry.target); // only animate once
        }
      });
    },
    { threshold: 0.15 }
  );

  revealElements.forEach((el) => revealObserver.observe(el));
}


/* ----------------------------------------------------------
   3. ADMIN LOGIN + LIVE DASHBOARD (admin.html only)
   ------------------------------------------------------------
   The password is now checked on the SERVER (see server.js),
   not in this file, so it's no longer visible by viewing page
   source. After logging in, the dashboard fetches the real
   contact-form messages and stats from the database via the
   /api/admin/... endpoints.
   ---------------------------------------------------------- */
const adminLogin = document.getElementById('adminLogin');
const adminDashboard = document.getElementById('adminDashboard');
const loginBtn = document.getElementById('loginBtn');
const adminPasswordInput = document.getElementById('adminPassword');
const errorMsg = document.getElementById('errorMsg');
const logoutBtn = document.getElementById('logoutBtn');

if (adminLogin && adminDashboard) {
  const SESSION_KEY = 'wws_admin_token';

  function authHeaders() {
    return { Authorization: `Bearer ${sessionStorage.getItem(SESSION_KEY) || ''}` };
  }

  function showDashboard() {
    adminLogin.classList.add('hidden');
    adminDashboard.classList.remove('hidden');
    errorMsg.classList.remove('show');
    loadDashboardData();
  }

  function showLogin() {
    adminDashboard.classList.add('hidden');
    adminLogin.classList.remove('hidden');
    adminPasswordInput.value = '';
  }

  async function tryLogin() {
    loginBtn.disabled = true;
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPasswordInput.value }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        sessionStorage.setItem(SESSION_KEY, data.token);
        showDashboard();
      } else {
        errorMsg.classList.add('show');
      }
    } catch (err) {
      errorMsg.textContent = 'Could not reach the server. Is it running?';
      errorMsg.classList.add('show');
    } finally {
      loginBtn.disabled = false;
    }
  }

  async function loadDashboardData() {
    try {
      const [statsRes, messagesRes] = await Promise.all([
        fetch('/api/admin/stats', { headers: authHeaders() }),
        fetch('/api/admin/messages', { headers: authHeaders() }),
      ]);

      if (statsRes.status === 401 || messagesRes.status === 401) {
        sessionStorage.removeItem(SESSION_KEY);
        showLogin();
        return;
      }

      const statsData = await statsRes.json();
      const messagesData = await messagesRes.json();
      renderStats(statsData.stats);
      renderMessages(messagesData.messages);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  }

  function renderStats(stats) {
    const totalEl = document.getElementById('statTotal');
    const unreadEl = document.getElementById('statUnread');
    if (totalEl) totalEl.textContent = stats.total;
    if (unreadEl) unreadEl.textContent = stats.unread;
  }

  function renderMessages(messages) {
    const tbody = document.getElementById('messagesTableBody');
    const empty = document.getElementById('messagesEmpty');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!messages.length) {
      if (empty) empty.classList.remove('hidden');
      return;
    }
    if (empty) empty.classList.add('hidden');

    messages.forEach((m) => {
      const tr = document.createElement('tr');
      if (!m.read) tr.classList.add('is-unread');

      const date = new Date(m.createdAt).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
      });

      tr.innerHTML = `
        <td>${m.name}</td>
        <td>${m.email}</td>
        <td>${m.phone || '—'}</td>
        <td>${m.subject}</td>
        <td>${date}</td>
        <td class="dash-actions">
          ${m.read ? '' : `<button class="dash-btn mark-read" data-id="${m.id}" title="Mark as read"><i class="fa-solid fa-envelope-open"></i></button>`}
          <button class="dash-btn delete-msg" data-id="${m.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </td>
      `;

      // Clicking a row shows the full message in a simple alert-free way
      tr.querySelector('td:nth-child(4)').addEventListener('click', () => {
        alert(`Message from ${m.name}:\n\n${m.message}`);
      });

      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.mark-read').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await fetch(`/api/admin/messages/${btn.dataset.id}/read`, {
          method: 'POST',
          headers: authHeaders(),
        });
        loadDashboardData();
      });
    });

    tbody.querySelectorAll('.delete-msg').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this message? This cannot be undone.')) return;
        await fetch(`/api/admin/messages/${btn.dataset.id}`, {
          method: 'DELETE',
          headers: authHeaders(),
        });
        loadDashboardData();
      });
    });
  }

  loginBtn.addEventListener('click', tryLogin);

  // Also allow pressing Enter in the password field
  adminPasswordInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') tryLogin();
  });

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await fetch('/api/admin/logout', { method: 'POST', headers: authHeaders() });
      sessionStorage.removeItem(SESSION_KEY);
      showLogin();
    });
  }

  // Stay logged in across page refreshes if we already have a token
  if (sessionStorage.getItem(SESSION_KEY)) {
    showDashboard();
  }
}


/* ----------------------------------------------------------
   4. CONTACT FORM (contact.html only)
   ------------------------------------------------------------
   Submits the form to /api/contact on the server, which saves
   it into the real database (data/messages.json) so it shows
   up on the admin dashboard.
   ---------------------------------------------------------- */
const contactForm = document.getElementById('contactForm');
const formSuccess = document.getElementById('formSuccess');
const formError = document.getElementById('formError');

if (contactForm) {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = contactForm.querySelector('button[type="submit"]');
    const formData = new FormData(contactForm);
    const payload = Object.fromEntries(formData.entries());

    formSuccess.classList.remove('show');
    if (formError) formError.classList.remove('show');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok && data.ok) {
        formSuccess.classList.add('show');
        contactForm.reset();
      } else if (formError) {
        formError.textContent = data.error || 'Something went wrong. Please try again.';
        formError.classList.add('show');
      }
    } catch (err) {
      if (formError) {
        formError.textContent = 'Could not reach the server. Please check your connection and try again.';
        formError.classList.add('show');
      }
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}


/* ----------------------------------------------------------
   5. WHATSAPP FLOATING BUTTON (every page)
   ------------------------------------------------------------
   Injects a floating WhatsApp button in the bottom-right corner
   that opens a chat with your business number. Change the
   number in WHATSAPP_NUMBER below (see also the comment on the
   button element itself).
   ---------------------------------------------------------- */
const whatsappBtn = document.getElementById('whatsappFloatBtn');
if (whatsappBtn) {
  // No JS needed beyond this — it's a plain link — but we keep
  // this hook in case you want to add click tracking later.
}
