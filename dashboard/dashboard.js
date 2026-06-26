// ─── Config ───────────────────────────────────────────────
const API = 'http://localhost:3000/api';

// ─── Security: HTML escape user strings before innerHTML ──
function escapeHtml(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function getToken() {
  return localStorage.getItem('storno_token');
}

function getCurrentOrg() {
  return localStorage.getItem('storno_org') || 'mallorca';
}

let currentTab = 'listings';

// ─── Auth ─────────────────────────────────────────────────
async function handleLogin() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    
    localStorage.setItem('storno_token', data.tokens.accessToken);
    localStorage.setItem('storno_user', data.user.email);
    localStorage.setItem('storno_org', data.organization.subdomain);
    showDashboard();
  } catch (err) {
    showToast('Login fehlgeschlagen: ' + err.message, 'error');
  }
}

function handleLogout() {
  localStorage.removeItem('storno_token');
  localStorage.removeItem('storno_user');
  localStorage.removeItem('storno_org');
  document.getElementById('login-modal').classList.remove('hidden');
  document.getElementById('navbar').classList.add('hidden');
  document.getElementById('main-content').classList.add('hidden');
}

function showDashboard() {
  document.getElementById('login-modal').classList.add('hidden');
  document.getElementById('navbar').classList.remove('hidden');
  document.getElementById('main-content').classList.remove('hidden');
  document.getElementById('user-name').textContent = localStorage.getItem('storno_user');
  loadStats();
  loadListings();
}

// ─── API Helpers ───────────────────────────────────────────
async function apiGet(endpoint) {
  const token = getToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${endpoint}`, { headers });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function apiPost(endpoint, body) {
  const token = getToken();
  const res = await fetch(`${API}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function apiPut(endpoint, body) {
  const token = getToken();
  const res = await fetch(`${API}${endpoint}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ─── Stats ────────────────────────────────────────────────
async function loadStats() {
  try {
    const data = await apiGet(`/listings?org=${getCurrentOrg()}&status=all`);
    const listings = data.listings || [];
    const pending = listings.filter(l => l.status === 'PENDING_APPROVAL').length;
    const active = listings.filter(l => l.status === 'ACTIVE').length;
    const sold = listings.filter(l => ['PENDING', 'SOLD'].includes(l.status)).length;
    document.getElementById('stat-pending').textContent = pending;
    document.getElementById('stat-active').textContent = active;
    document.getElementById('stat-sold').textContent = sold;
  } catch (err) {
    console.error('Stats error:', err);
  }
}

// ─── Listings ─────────────────────────────────────────────
async function loadListings() {
  const tbody = document.getElementById('listings-body');
  tbody.innerHTML = '<tr><td colspan="5" class="loading">Lädt...</td></tr>';
  
  try {
    const data = await apiGet(`/listings?org=${getCurrentOrg()}&status=all`);
    const listings = data.listings || [];
    
    if (listings.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty">Keine Listings vorhanden</td></tr>';
      return;
    }
    
    tbody.innerHTML = listings.map(l => {
      const approveBtns = l.status === 'PENDING_APPROVAL' 
        ? `<button class="btn btn-sm btn-success" data-action="approve" data-id="${l.id}">✓ Freigeben</button>
           <button class="btn btn-sm btn-danger" data-action="reject" data-id="${l.id}">✗ Ablehnen</button>`
        : '';
      
      return `<tr>
        <td><strong>${escapeHtml(l.destination)}</strong><br><small style="color:#999">${escapeHtml(l.hotelName) || '-'}</small></td>
        <td>${formatDate(l.departureDate)}</td>
        <td>
          <span style="text-decoration:line-through;color:#999">${formatPrice(l.originalPriceCents)}</span><br>
          <strong style="color:#10b981">${formatPrice(l.askingPriceCents)}</strong>
        </td>
        <td>${l.status === 'PENDING_APPROVAL' ? `<span class="badge badge-PENDING">⏳ Wartet auf Freigabe</span>` : `<span class="badge badge-${l.status}">${l.status}</span>`}</td>
        <td>
          <button class="btn btn-sm btn-primary" data-action="view-listing" data-id="${l.id}">👁️ Ansehen</button>
          ${approveBtns}
        </td>
      </tr>`;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="error">Fehler: ${escapeHtml(err.message)}</td></tr>`;
  }
}

// ─── Listing Detail Modal ──────────────────────────────────
async function showListingDetail(id) {
  try {
    const data = await apiGet(`/listings/${id}`);
    const l = data.listing;
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '2000';
    
    // Helper to format date for input fields (YYYY-MM-DD)
    const toInputDate = (dateStr) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      return d.toISOString().split('T')[0];
    };
    
    const isEditable = l.status !== 'ACTIVE' && l.status !== 'SOLD' && l.status !== 'CANCELLED';
    const isPendingApproval = l.status === 'PENDING_APPROVAL';
    
    modal.innerHTML = `
      <div class="modal" style="max-width:760px;max-height:90vh;overflow-y:auto;">
        <button class="modal-close-btn" style="position:absolute;top:12px;right:12px;background:none;border:none;font-size:1.5rem;cursor:pointer;color:#999;">&times;</button>
        
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
          <div>
            <h2 style="margin:0 0 4px 0;">
              <input type="text" id="edit-destination" value="${l.destination || ''}" 
                style="font-size:1.3rem;font-weight:700;border:1px solid #e5e7eb;border-radius:6px;padding:4px 8px;width:350px;" 
                placeholder="Destination (z.B. Mallorca, Spanien)">
            </h2>
            <p style="color:#666;margin:0;font-size:0.9rem;">
              Buchung: <input type="text" id="edit-booking-ref" value="${l.originalBookingRef || ''}" 
                style="border:1px solid #e5e7eb;border-radius:6px;padding:2px 6px;font-size:0.9rem;" placeholder="Buchungs-Nr">
            </p>
          </div>
          <span class="badge badge-${l.status}" id="edit-status-badge" style="font-size:0.9rem;padding:6px 12px;">${l.status}</span>
        </div>
        
        ${isPendingApproval ? `
        <div style="background:#fef3c7;border-radius:8px;padding:16px;margin-bottom:16px;">
          <strong>⚠️ Wartet auf Freigabe</strong> — Bitte alle Daten prüfen und ergänzen, dann Speichern + Freigeben.
        </div>
        ` : ''}
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <!-- Reisedaten -->
          <div class="card" style="grid-column:1/-1;">
            <div class="card-header">📅 Reisedaten</div>
            <div style="padding:16px;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;">
              <div>
                <label style="font-size:0.75rem;color:#666;">Hinflug</label>
                <input type="date" id="edit-departure-date" value="${toInputDate(l.departureDate)}" 
                  style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;">
              </div>
              <div>
                <label style="font-size:0.75rem;color:#666;">Rückflug</label>
                <input type="date" id="edit-return-date" value="${toInputDate(l.returnDate)}" 
                  style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;">
              </div>
              <div>
                <label style="font-size:0.75rem;color:#666;">Originalpreis (€)</label>
                <input type="number" id="edit-original-price" value="${((l.originalPriceCents || 0) / 100).toFixed(2)}" 
                  style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;" step="0.01">
              </div>
              <div>
                <label style="font-size:0.75rem;color:#666;">Wunschpreis (€)</label>
                <input type="number" id="edit-asking-price" value="${((l.askingPriceCents || 0) / 100).toFixed(2)}" 
                  style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;" step="0.01">
              </div>
            </div>
          </div>
          
          <!-- Flug -->
          <div class="card" style="grid-column:1/-1;">
            <div class="card-header">✈️ Flug (vom Reiseveranstalter)</div>
            <div style="padding:16px;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;">
              <div>
                <label style="font-size:0.75rem;color:#666;">Flughafen Abflug</label>
                <input type="text" id="edit-departure-airport" value="${l.departureAirport || ''}" 
                  style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;" placeholder="München (MUC)">
              </div>
              <div>
                <label style="font-size:0.75rem;color:#666;">Flughafen Ankunft</label>
                <input type="text" id="edit-arrival-airport" value="${l.arrivalAirport || ''}" 
                  style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;" placeholder="Palma de Mallorca (PMI)">
              </div>
              <div>
                <label style="font-size:0.75rem;color:#666;">Hinflug Datum</label>
                <input type="date" id="edit-flight-outbound-date" value="${toInputDate(l.flightOutboundDate)}" 
                  style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;">
              </div>
              <div>
                <label style="font-size:0.75rem;color:#666;">Hinflug Zeit</label>
                <input type="time" id="edit-flight-outbound-time" value="${l.flightOutboundTime || ''}" 
                  style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;">
              </div>
              <div>
                <label style="font-size:0.75rem;color:#666;">Rückflug Datum</label>
                <input type="date" id="edit-flight-return-date" value="${toInputDate(l.flightReturnDate)}" 
                  style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;">
              </div>
              <div>
                <label style="font-size:0.75rem;color:#666;">Rückflug Zeit</label>
                <input type="time" id="edit-flight-return-time" value="${l.flightReturnTime || ''}" 
                  style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;">
              </div>
              <div>
                <label style="font-size:0.75rem;color:#666;">Airline</label>
                <input type="text" id="edit-airline" value="${l.airline || ''}" 
                  style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;" placeholder="TUIfly">
              </div>
              <div>
                <label style="font-size:0.75rem;color:#666;">Flugnummer</label>
                <input type="text" id="edit-flight-number" value="${l.flightNumber || ''}" 
                  style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;" placeholder="X3 1234">
              </div>
              <div style="grid-column:1/-1;">
                <label style="font-size:0.75rem;color:#666;">Gepäck</label>
                <input type="text" id="edit-baggage" value="${l.baggage || ''}" 
                  style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;" placeholder="1x23kg + Handgepäck">
              </div>
            </div>
          </div>
          
          <!-- Hotel -->
          <div class="card">
            <div class="card-header">🏨 Hotel</div>
            <div style="padding:16px;">
              <div style="margin-bottom:10px;">
                <label style="font-size:0.75rem;color:#666;">Hotelname</label>
                <input type="text" id="edit-hotel-name" value="${l.hotelName || ''}" 
                  style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;">
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
                <div>
                  <label style="font-size:0.75rem;color:#666;">Sterne</label>
                  <select id="edit-hotel-stars" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;">
                    <option value="">—</option>
                    ${[1,2,3,4,5].map(n => `<option value="${n}" ${l.hotelStars == n ? 'selected' : ''}>${'★'.repeat(n)}${'☆'.repeat(5-n)}</option>`).join('')}
                  </select>
                </div>
                <div>
                  <label style="font-size:0.75rem;color:#666;">Sterne (verifiziert)</label>
                  <select id="edit-hotel-stars-verified" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;">
                    <option value="">—</option>
                    ${[1,2,3,4,5].map(n => `<option value="${n}" ${l.hotelStarsVerified == n ? 'selected' : ''}>${'★'.repeat(n)}${'☆'.repeat(5-n)}</option>`).join('')}
                  </select>
                </div>
              </div>
              <div style="margin-bottom:10px;">
                <label style="font-size:0.75rem;color:#666;">Adresse</label>
                <input type="text" id="edit-hotel-address" value="${l.hotelAddress || ''}" 
                  style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;">
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div>
                  <label style="font-size:0.75rem;color:#666;">Zimmerkategorie</label>
                  <input type="text" id="edit-room-category" value="${l.roomCategory || ''}" 
                    style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;" placeholder="Doppelzimmer">
                </div>
                <div>
                  <label style="font-size:0.75rem;color:#666;">Verpflegung</label>
                  <select id="edit-board-type" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;">
                    <option value="">—</option>
                    <option value="AI" ${l.boardType === 'AI' ? 'selected' : ''}>All Inclusive</option>
                    <option value="HP" ${l.boardType === 'HP' ? 'selected' : ''}>Halbpension</option>
                    <option value="BB" ${l.boardType === 'BB' ? 'selected' : ''}>Frühstück</option>
                    <option value="SC" ${l.boardType === 'SC' ? 'selected' : ''}>Selbstversorgung</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Transfer -->
          <div class="card">
            <div class="card-header">🚐 Transfer</div>
            <div style="padding:16px;">
              <div style="margin-bottom:10px;">
                <label style="font-size:0.8rem;">
                  <input type="checkbox" id="edit-transfer-included" ${l.transferIncluded ? 'checked' : ''}> Transfer inklusive
                </label>
              </div>
              <div>
                <label style="font-size:0.75rem;color:#666;">Transfertyp</label>
                <select id="edit-transfer-type" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;">
                  <option value="">—</option>
                  <option value="PRIVAT" ${l.transferType === 'PRIVAT' ? 'selected' : ''}>Privat</option>
                  <option value="SHUTTLE" ${l.transferType === 'SHUTTLE' ? 'selected' : ''}>Shuttle</option>
                  <option value="SELBST" ${l.transferType === 'SELBST' ? 'selected' : ''}>Eigene Anreise</option>
                </select>
              </div>
            </div>
          </div>
          
          <!-- Verkäufer -->
          <div class="card">
            <div class="card-header">👤 Verkäufer</div>
            <div style="padding:16px;">
              <div style="margin-bottom:10px;">
                <label style="font-size:0.75rem;color:#666;">Anonymisiert</label>
                <div style="padding:8px;background:#f9fafb;border-radius:6px;font-weight:600;">${l.sellerNameAnonymous || '-'}</div>
              </div>
              <div>
                <label style="font-size:0.75rem;color:#666;">Stornierungsgrund</label>
                <input type="text" id="edit-seller-reason" value="${l.sellerReason || ''}" 
                  style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;">
              </div>
            </div>
          </div>
          
          <!-- Beschreibung -->
          <div class="card">
            <div class="card-header">📝 Beschreibung</div>
            <div style="padding:16px;">
              <textarea id="edit-description" rows="3" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;resize:vertical;">${l.description || ''}</textarea>
            </div>
          </div>
        </div>
        
        <div style="margin-top:20px;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
          ${l.status === 'REJECTED' ? `
            <button class="btn btn-primary" id="btn-reopen" data-action="reopen-listing" data-id="${l.id}">↻ Erneut zur Prüfung</button>
          ` : ''}
          ${isPendingApproval ? `
            <button class="btn btn-danger" id="btn-reject-listing" data-action="reject" data-id="${l.id}">✗ Ablehnen</button>
            <button class="btn btn-success" id="btn-save-and-approve">💾 Speichern & ✓ Freigeben</button>
          ` : `
            <button class="btn btn-primary" id="btn-save">💾 Speichern</button>
          `}
        </div>
        <div id="edit-save-status" style="margin-top:10px;text-align:right;font-size:0.85rem;"></div>
      </div>
    `;
    
    document.body.appendChild(modal);
    modal.querySelector('.modal-close-btn').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    
    // Save handler
    const saveBtn = document.getElementById('btn-save');
    const saveAndApproveBtn = document.getElementById('btn-save-and-approve');
    const rejectListingBtn = document.getElementById('btn-reject-listing');
    const reopenBtn = document.getElementById('btn-reopen');
    const statusEl = document.getElementById('edit-save-status');
    
    const getFormData = () => ({
      destination: document.getElementById('edit-destination').value,
      originalBookingRef: document.getElementById('edit-booking-ref').value,
      departureDate: document.getElementById('edit-departure-date').value || undefined,
      returnDate: document.getElementById('edit-return-date').value || undefined,
      originalPriceCents: Math.round(parseFloat(document.getElementById('edit-original-price').value || '0') * 100),
      askingPriceCents: Math.round(parseFloat(document.getElementById('edit-asking-price').value || '0') * 100),
      description: document.getElementById('edit-description').value,
      departureAirport: document.getElementById('edit-departure-airport').value || undefined,
      arrivalAirport: document.getElementById('edit-arrival-airport').value || undefined,
      flightOutboundDate: document.getElementById('edit-flight-outbound-date').value || undefined,
      flightOutboundTime: document.getElementById('edit-flight-outbound-time').value || undefined,
      flightReturnDate: document.getElementById('edit-flight-return-date').value || undefined,
      flightReturnTime: document.getElementById('edit-flight-return-time').value || undefined,
      airline: document.getElementById('edit-airline').value || undefined,
      flightNumber: document.getElementById('edit-flight-number').value || undefined,
      baggage: document.getElementById('edit-baggage').value || undefined,
      hotelName: document.getElementById('edit-hotel-name').value || undefined,
      hotelStars: parseInt(document.getElementById('edit-hotel-stars').value) || undefined,
      hotelStarsVerified: parseInt(document.getElementById('edit-hotel-stars-verified').value) || undefined,
      hotelAddress: document.getElementById('edit-hotel-address').value || undefined,
      roomCategory: document.getElementById('edit-room-category').value || undefined,
      boardType: document.getElementById('edit-board-type').value || undefined,
      transferIncluded: document.getElementById('edit-transfer-included').checked,
      transferType: document.getElementById('edit-transfer-type').value || undefined,
      sellerReason: document.getElementById('edit-seller-reason').value || undefined
    });
    
    const doSave = async (alsoApprove = false) => {
      const btn = alsoApprove ? saveAndApproveBtn : saveBtn;
      btn.disabled = true;
      btn.textContent = '⏳ Speichert...';
      statusEl.textContent = '';
      
      try {
        const payload = getFormData();
        // Remove undefined fields
        Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
        
        await apiPut(`/listings/${id}`, payload);
        statusEl.style.color = '#059669';
        statusEl.textContent = '✅ Gespeichert!';
        
        if (alsoApprove) {
          await apiPost(`/listings/${id}/approve`, {});
          statusEl.textContent = '✅ Gespeichert & freigegeben!';
          modal.remove();
          showToast('Listing freigegeben! ✅');
          loadListings();
          loadStats();
        } else {
          loadListings();
        }
      } catch (err) {
        statusEl.style.color = '#dc2626';
        statusEl.textContent = '❌ Fehler: ' + err.message;
        btn.disabled = false;
        btn.textContent = alsoApprove ? '💾 Speichern & ✓ Freigeben' : '💾 Speichern';
      }
    };
    
    if (saveBtn) saveBtn.onclick = () => doSave(false);
    if (saveAndApproveBtn) saveAndApproveBtn.onclick = () => doSave(true);
    if (rejectListingBtn) {
      rejectListingBtn.onclick = async () => {
        const reason = prompt('Ablehnungsgrund (optional):');
        try {
          await apiPost(`/listings/${id}/reject`, { reason });
          modal.remove();
          showToast('Listing abgelehnt.');
          loadListings();
          loadStats();
        } catch (err) {
          showToast('Fehler: ' + err.message, 'error');
        }
      };
    }
  } catch (err) {
    showToast('Fehler: ' + err.message, 'error');
  }
}

// ─── Listing Actions ───────────────────────────────────────
async function approveListing(id) {
  if (!confirm('Listing freigeben? Es wird dann im Widget sichtbar.')) return;
  try {
    await apiPost(`/listings/${id}/approve`, {});
    showToast('Listing freigegeben! ✅');
    loadListings();
    loadStats();
  } catch (err) {
    showToast('Fehler: ' + err.message, 'error');
  }
}

async function reopenListing(id) {
  if (!confirm('Listing erneut zur Prüfung öffnen?')) return;
  try {
    await apiPut(`/listings/${id}`, { status: 'PENDING_APPROVAL' });
    showToast('Listing zur Prüfung geöffnet.');
    loadListings();
    loadStats();
  } catch (err) {
    showToast('Fehler: ' + err.message, 'error');
  }
}

async function rejectListing(id) {
  const reason = prompt('Ablehnungsgrund (optional):');
  try {
    await apiPost(`/listings/${id}/reject`, { reason });
    showToast('Listing abgelehnt.');
    loadListings();
    loadStats();
  } catch (err) {
    showToast('Fehler: ' + err.message, 'error');
  }
}

// ─── Transfers ────────────────────────────────────────────
async function loadTransfers() {
  const tbody = document.getElementById('transfers-body');
  tbody.innerHTML = '<tr><td colspan="6" class="loading">Lädt...</td></tr>';
  
  try {
    const data = await apiGet('/transfers');
    const transfers = data.transfers || [];
    
    if (transfers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty">Keine Transfers vorhanden</td></tr>';
      return;
    }
    
    const genderLabels = { male: 'Herr', female: 'Frau', diverse: 'Divers' };
    
    tbody.innerHTML = transfers.map(t => {
      const buyerName = t.buyer?.firstName && t.buyer?.lastName
        ? `${genderLabels[t.buyer.firstName] || ''} ${escapeHtml(t.buyer.firstName)} ${escapeHtml(t.buyer.lastName)}`.trim()
        : '-';
      
      const actionBtns = t.status === 'PAID' 
        ? `<button class="btn btn-sm btn-success" data-action="complete-transfer" data-id="${t.id}">✓ Abschließen</button>
           <button class="btn btn-sm btn-danger" data-action="reject-transfer" data-id="${t.id}">✗ Ablehnen</button>`
        : t.status === 'COMPLETED' 
        ? '<span style="color:#10b981">✓ Abgeschlossen</span>'
        : '-';
      
      return `<tr>
        <td><code style="font-size:0.7rem">${escapeHtml(t.id.substring(0, 8))}...</code></td>
        <td>${escapeHtml(t.listing?.destination) || 'N/A'}<br><small style="color:#999">${formatPrice(t.amountCents)}</small></td>
        <td>${t.seller?.firstName ? escapeHtml(t.seller.firstName) + ' ' + (t.seller.lastName ? escapeHtml(t.seller.lastName) : '') : '-'}</td>
        <td>${buyerName}</td>
        <td><span class="badge badge-${t.status}">${t.status}</span></td>
        <td>
          <button class="btn btn-sm btn-primary" data-action="view-transfer" data-id="${t.id}">👁️ Ansehen</button>
          ${actionBtns}
        </td>
      </tr>`;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="error">Fehler: ${err.message}</td></tr>`;
  }
}

// ─── Transfer Detail Modal ─────────────────────────────────
// Shows FULL buyer + seller data — ADMIN ONLY, never public
async function showTransferDetail(id) {
  try {
    const data = await apiGet(`/transfers/${id}`);
    const t = data.transfer;
    const genderLabels = { male: 'Herr', female: 'Frau', diverse: 'Divers' };
    const statusLabels = {
      PENDING: 'Offen',
      PAID: 'Bezahlt',
      COMPLETED: 'Abgeschlossen',
      REFUNDED: 'Refundiert',
      CANCELLED: 'Storniert'
    };
    
    const b = t.buyer || {};
    const s = t.seller || {};
    
    const buyerFullName = [
      b.title ? b.title + ' ' : '',
      genderLabels[b.gender] || '',
      b.firstName || '',
      b.lastName || ''
    ].filter(Boolean).join(' ');

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '2000';
    
    modal.innerHTML = `
      <div class="modal" style="max-width:680px;max-height:90vh;overflow-y:auto;">
        <button class="modal-close-btn" style="position:absolute;top:12px;right:12px;background:none;border:none;font-size:1.5rem;cursor:pointer;color:#999;">&times;</button>
        
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
          <div>
            <h2 style="margin:0;">${t.listing?.destination || 'Reise'}</h2>
            <p style="color:#666;margin:4px 0 0 0;font-size:0.9rem;">${t.listing?.originalBookingRef || ''}</p>
          </div>
          <span class="badge badge-${t.status}">${statusLabels[t.status] || t.status}</span>
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <!-- BUYER - FULL DATA (Admin only) -->
          <div class="card" style="grid-column:1/-1;border:2px solid #667eea;">
            <div class="card-header" style="background:#667eea;color:white;">👤 Käufer (B) — Vollständige Daten</div>
            <div style="padding:16px;">
              <table style="width:100%;font-size:0.9rem;gap:8px;">
                <tr><td style="color:#999;width:120px;">Name:</td><td><strong>${buyerFullName || '-'}</strong></td></tr>
                <tr><td style="color:#999;">Geburtsdatum:</td><td>${b.birthDate ? formatDate(b.birthDate) : '-'}</td></tr>
                ${b.birthPlace ? `<tr><td style="color:#999;">Geburtsort:</td><td>${b.birthPlace}</td></tr>` : ''}
                <tr><td style="color:#999;">Nationalität:</td><td>${b.nationality || '-'}</td></tr>
                <tr><td style="color:#999;">E-Mail:</td><td><a href="mailto:${b.email}">${b.email || '-'}</a></td></tr>
                ${b.phone ? `<tr><td style="color:#999;">Telefon:</td><td>${b.phone}</td></tr>` : ''}
                <tr><td style="color:#999;">Straße:</td><td>${b.street ? b.street + ' ' + (b.houseNumber || '') : '-'}</td></tr>
                <tr><td style="color:#999;">PLZ / Ort:</td><td>${b.postalCode ? b.postalCode + ' ' + (b.city || '') : '-'}</td></tr>
                <tr><td style="color:#999;">Land:</td><td>${b.country || '-'}</td></tr>
              </table>
            </div>
          </div>
          
          <!-- SELLER -->
          <div class="card">
            <div class="card-header">👤 Verkäufer</div>
            <div style="padding:16px;font-size:0.9rem;">
              <strong>${s.firstName ? s.firstName + ' ' + (s.lastName || '') : 'Anon'}</strong>
            </div>
          </div>
          
          <!-- PAYMENT -->
          <div class="card">
            <div class="card-header">💰 Zahlung</div>
            <div style="padding:16px;">
              <div style="font-size:1.3rem;font-weight:700;color:#10b981;">${formatPrice(t.amountCents)}</div>
              <table style="width:100%;font-size:0.85rem;margin-top:8px;color:#666;">
                <tr><td>Platform-Gebühr:</td><td style="text-align:right;">-${formatPrice(t.platformFeeCents)}</td></tr>
                ${t.creatorRoyaltyCents ? `<tr><td>Agency-Anteil:</td><td style="text-align:right;">-${formatPrice(t.creatorRoyaltyCents)}</td></tr>` : ''}
                <tr><td><strong>Verkäufer-Auszahlung:</strong></td><td style="text-align:right;"><strong>${formatPrice(t.sellerPayoutCents)}</strong></td></tr>
              </table>
              <hr style="margin:8px 0;border:none;border-top:1px solid #eee;">
              <table style="width:100%;font-size:0.85rem;color:#666;">
                <tr><td>Erstellt:</td><td style="text-align:right;">${formatDate(t.createdAt)}</td></tr>
                ${t.paidAt ? `<tr><td>Bezahlt:</td><td style="text-align:right;">${formatDate(t.paidAt)}</td></tr>` : ''}
                ${t.completedAt ? `<tr><td>Abgeschlossen:</td><td style="text-align:right;color:#10b981;">${formatDate(t.completedAt)}</td></tr>` : ''}
              </table>
            </div>
          </div>
        </div>
        
        ${t.reassignmentNotes ? `
        <div class="card" style="margin-top:16px;">
          <div class="card-header">📝 Notizen</div>
          <div style="padding:16px;font-size:0.9rem;">${t.reassignmentNotes}</div>
        </div>
        ` : ''}
        
        ${t.status === 'PAID' ? `
        <div style="margin-top:16px;display:flex;gap:8px;">
          <button class="btn btn-success" style="flex:1;" data-action="complete-transfer" data-id="${t.id}">✓ Abschließen — Auszahlung an Verkäufer</button>
          <button class="btn btn-danger" data-action="reject-transfer" data-id="${t.id}">✗ Ablehnen</button>
        </div>
        ` : ''}
      </div>
    `;
    
    document.body.appendChild(modal);
    modal.querySelector('.modal-close-btn').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  } catch (err) {
    showToast('Fehler: ' + err.message, 'error');
  }
}

async function completeTransfer(id) {
  if (!confirm('Transfer abschließen? Geld wird an Verkäufer überwiesen.')) return;
  try {
    await apiPost(`/transfers/${id}/complete`, { notes: 'Demo completed' });
    showToast('Transfer abgeschlossen! ✅');
    loadTransfers();
    loadStats();
  } catch (err) {
    showToast('Fehler: ' + err.message, 'error');
  }
}

async function rejectTransfer(id) {
  const reason = prompt('Ablehnungsgrund:');
  try {
    await apiPost(`/transfers/${id}/reject`, { reason });
    showToast('Transfer abgelehnt - Geld wird refundiert.');
    loadTransfers();
  } catch (err) {
    showToast('Fehler: ' + err.message, 'error');
  }
}

// ─── Event Delegation ─────────────────────────────────────
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  
  const action = btn.dataset.action;
  const id = btn.dataset.id;
  
  if (action === 'view-listing') {
    showListingDetail(id);
  } else if (action === 'approve') {
    approveListing(id);
    if (btn.dataset.closeModal) btn.closest('.modal-overlay')?.remove();
  } else if (action === 'reject') {
    rejectListing(id);
    if (btn.dataset.closeModal) btn.closest('.modal-overlay')?.remove();
  } else if (action === 'reopen-listing') {
    reopenListing(id);
  } else if (action === 'view-transfer') {
    showTransferDetail(id);
  } else if (action === 'complete-transfer') {
    completeTransfer(id);
  } else if (action === 'reject-transfer') {
    rejectTransfer(id);
  }
});

// ─── Tab Switching ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const tabContainer = document.getElementById('tab-container');
  if (tabContainer) {
    tabContainer.addEventListener('click', (e) => {
      const tab = e.target.closest('.tab');
      if (!tab) return;
      
      currentTab = tab.dataset.tab;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      document.getElementById('tab-listings').classList.toggle('hidden', currentTab !== 'listings');
      document.getElementById('tab-transfers').classList.toggle('hidden', currentTab !== 'transfers');
      
      if (currentTab === 'transfers') loadTransfers();
    });
  }

  document.getElementById('login-submit-btn')?.addEventListener('click', handleLogin);
  document.getElementById('login-password')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
  document.getElementById('logout-btn')?.addEventListener('click', handleLogout);

  if (localStorage.getItem('storno_token')) showDashboard();
});

// ─── Helpers ─────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatPrice(cents) {
  return ((cents || 0) / 100).toFixed(2) + ' €';
}

function getStars(count) {
  return '★'.repeat(count || 0) + '☆'.repeat(5 - (count || 0));
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toast.style.background = type === 'error' ? '#ef4444' : '#1a1a2e';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
