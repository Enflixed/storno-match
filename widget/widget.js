/**
 * StornoMatch Widget v2 - Buyer Form with full passenger data
 */
(function() {
  'use strict';

  const API_BASE = window.STORNOMATCH_API || 'http://localhost:3000';

  // ─── Security: HTML escape before innerHTML ───────────────
  function escapeHtml(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  // Pre-sanitize all user-controlled text fields to prevent XSS
  function sanitizeListing(listing) {
    return {
      ...listing,
      destination: escapeHtml(listing.destination),
      hotelName: escapeHtml(listing.hotelName),
      hotelAddress: escapeHtml(listing.hotelAddress),
      departureAirport: escapeHtml(listing.departureAirport),
      arrivalAirport: escapeHtml(listing.arrivalAirport),
      airline: escapeHtml(listing.airline),
      flightNumber: escapeHtml(listing.flightNumber),
      baggage: escapeHtml(listing.baggage),
      roomCategory: escapeHtml(listing.roomCategory),
      sellerNameAnonymous: escapeHtml(listing.sellerNameAnonymous),
      sellerReason: escapeHtml(listing.sellerReason),
      description: escapeHtml(listing.description),
    };
  }
  
  const styles = `
    .sm-widget {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
      color: #1a1a2e;
      background: #f8fafc;
    }
    .sm-widget-header {
      text-align: center;
      margin-bottom: 24px;
    }
    .sm-widget-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: #1a1a2e;
      margin: 0 0 8px 0;
    }
    .sm-widget-subtitle {
      color: #666;
      font-size: 0.9rem;
      margin: 0;
    }
    
    .sm-listing-card {
      background: white;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      margin-bottom: 24px;
    }
    .sm-listing-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .sm-destination {
      font-size: 1.4rem;
      font-weight: 700;
      margin: 0 0 4px 0;
    }
    .sm-travel-dates {
      font-size: 0.9rem;
      opacity: 0.9;
    }
    .sm-price-badge {
      background: white;
      color: #10b981;
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: 700;
      font-size: 1.1rem;
      text-align: right;
    }
    .sm-price-badge span {
      display: block;
      font-size: 0.75rem;
      font-weight: 400;
      color: #999;
      text-decoration: line-through;
    }
    
    .sm-listing-body { padding: 24px; }
    
    .sm-section { margin-bottom: 20px; }
    .sm-section-title {
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      color: #667eea;
      margin-bottom: 12px;
      letter-spacing: 0.5px;
    }
    .sm-flight-grid {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      gap: 8px;
      align-items: center;
      background: #f8fafc;
      padding: 16px;
      border-radius: 12px;
    }
    .sm-flight-endpoint { text-align: center; }
    .sm-flight-city { font-weight: 600; font-size: 1rem; }
    .sm-flight-time { color: #666; font-size: 0.9rem; }
    .sm-flight-airport { color: #999; font-size: 0.8rem; }
    .sm-flight-route { text-align: center; }
    .sm-flight-line {
      width: 60px;
      height: 2px;
      background: #d1d5db;
      margin: 0 auto 4px;
      position: relative;
    }
    .sm-flight-line::before {
      content: '✈';
      position: absolute;
      right: -4px;
      top: -8px;
      font-size: 0.7rem;
    }
    .sm-flight-number { font-size: 0.75rem; color: #999; }
    .sm-flight-datetime { display: flex; gap: 16px; margin-top: 8px; }
    .sm-flight-date { font-size: 0.85rem; color: #666; }
    .sm-return-flight { margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb; }
    .sm-baggage { margin-top: 8px; font-size: 0.85rem; color: #666; }
    .sm-baggage::before { content: '🧳 '; }
    
    .sm-hotel-card {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 12px;
      padding: 16px;
    }
    .sm-hotel-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
    .sm-hotel-name { font-weight: 700; font-size: 1.1rem; color: #1a1a2e; }
    .sm-hotel-stars { color: #f59e0b; font-size: 1rem; }
    .sm-hotel-address { font-size: 0.85rem; color: #666; margin-bottom: 12px; }
    .sm-hotel-address a { color: #667eea; text-decoration: none; }
    .sm-room-info { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
    .sm-tag {
      background: #e0e7ff;
      color: #4f46e5;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 500;
    }
    .sm-tag.board-tag { background: #d1fae5; color: #059669; }
    .sm-map-embed { width: 100%; height: 180px; border-radius: 8px; border: none; margin-top: 8px; }
    .sm-maps-link { display: inline-block; margin-top: 8px; font-size: 0.85rem; color: #667eea; text-decoration: none; }
    .sm-maps-link:hover { text-decoration: underline; }
    
    .sm-transfer-info {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 0.9rem;
      color: #166534;
    }
    .sm-transfer-info::before { content: '🚐 '; }
    
    .sm-seller-trust {
      background: #f9fafb;
      border-radius: 8px;
      padding: 12px 16px;
      margin-top: 16px;
      font-size: 0.85rem;
      color: #666;
    }
    .sm-seller-trust strong { color: #1a1a2e; }
    .sm-seller-reason { font-style: italic; margin-top: 4px; }
    
    .sm-price-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      border-top: 1px solid #e5e7eb;
      background: #f9fafb;
    }
    .sm-total-price { font-size: 1.5rem; font-weight: 700; color: #10b981; }
    .sm-total-price span {
      font-size: 0.85rem;
      font-weight: 400;
      color: #999;
      text-decoration: line-through;
      margin-right: 8px;
    }
    .sm-buy-btn {
      padding: 14px 32px;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .sm-buy-btn:hover { background: #5a6fd6; }
    .sm-buy-btn:disabled { background: #ccc; cursor: not-allowed; }
    
    .sm-loading { text-align: center; padding: 40px; color: #666; }
    .sm-error { text-align: center; padding: 20px; color: #ef4444; background: #fef2f2; border-radius: 8px; }
    .sm-empty { text-align: center; padding: 40px; color: #666; }
    
    .sm-modal-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: flex-start;
      justify-content: center;
      z-index: 10000;
      padding: 40px 16px;
      overflow-y: auto;
    }
    .sm-modal {
      background: white;
      border-radius: 16px;
      width: 100%;
      max-width: 560px;
      padding: 32px;
      position: relative;
    }
    .sm-modal-close {
      position: absolute;
      top: 16px;
      right: 16px;
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: #999;
    }
    .sm-modal h2 { margin: 0 0 4px 0; font-size: 1.5rem; }
    .sm-modal-destination { color: #666; margin-bottom: 20px; font-size: 0.95rem; }
    .sm-form-section {
      background: #f9fafb;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 16px;
    }
    .sm-form-section-title {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      color: #667eea;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }
    .sm-form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .sm-form-row-3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12px;
    }
    .sm-form-group { margin-bottom: 12px; }
    .sm-form-group label {
      display: block;
      font-size: 0.8rem;
      font-weight: 500;
      margin-bottom: 4px;
      color: #374151;
    }
    .sm-form-group input,
    .sm-form-group select {
      width: 100%;
      padding: 9px 12px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 0.95rem;
      box-sizing: border-box;
      background: white;
      color: #1a1a2e;
    }
    .sm-form-group input:focus,
    .sm-form-group select:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }
    .sm-form-group input::placeholder { color: #9ca3af; }
    .sm-form-group select { cursor: pointer; }
    .sm-required { color: #ef4444; }
    .sm-total-row {
      display: flex;
      justify-content: space-between;
      padding: 16px 0;
      border-top: 1px solid #e5e7eb;
      margin-top: 8px;
      font-weight: 600;
      font-size: 1.1rem;
    }
    .sm-checkout-btn {
      width: 100%;
      padding: 14px;
      background: #10b981;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
      margin-top: 8px;
    }
    .sm-checkout-btn:hover { background: #059669; }
    .sm-checkout-btn:disabled { background: #9ca3af; cursor: not-allowed; }
    .sm-success { text-align: center; padding: 20px; }
    .sm-success-icon { font-size: 4rem; margin-bottom: 16px; }
    .sm-privacy-note {
      font-size: 0.75rem;
      color: #9ca3af;
      text-align: center;
      margin-top: 12px;
      line-height: 1.4;
    }
  `;

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function formatPrice(cents) {
    return (cents / 100).toFixed(2) + ' €';
  }

  function getStars(count) {
    return '★'.repeat(count || 0) + '☆'.repeat(5 - (count || 0));
  }

  async function fetchListings(org) {
    const res = await fetch(`${API_BASE}/api/listings?org=${encodeURIComponent(org)}&status=ACTIVE`);
    if (!res.ok) throw new Error('Failed to fetch listings');
    const data = await res.json();
    return data.listings || [];
  }

  async function createTransfer(listingId, buyerData, apiKey) {
    const res = await fetch(`${API_BASE}/api/transfers`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        listingId,
        buyerSalutation: buyerData.salutation,
        buyerTitle: buyerData.title || null,
        buyerFirstName: buyerData.firstName,
        buyerLastName: buyerData.lastName,
        buyerBirthDate: buyerData.birthDate,
        buyerBirthPlace: buyerData.birthPlace || null,
        buyerEmail: buyerData.email,
        buyerPhone: buyerData.phone || null,
        buyerNationality: buyerData.nationality,
        buyerStreet: buyerData.street || null,
        buyerHouseNumber: buyerData.houseNumber || null,
        buyerPostalCode: buyerData.postalCode || null,
        buyerCity: buyerData.city || null,
        buyerCountry: buyerData.country || null
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Transfer failed');
    return data;
  }

  function showBuyModal(listing, apiKey) {
    const existing = document.querySelector('.sm-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'sm-modal-overlay';
    overlay.innerHTML = `
      <div class="sm-modal">
        <button class="sm-modal-close">&times;</button>
        <h2>Jetzt kaufen</h2>
        <p class="sm-modal-destination">${listing.destination} — ${formatDate(listing.departureDate)}</p>
        
        <!-- Personal Data -->
        <div class="sm-form-section">
          <div class="sm-form-section-title">👤 Persönliche Daten</div>
          <div class="sm-form-row">
            <div class="sm-form-group">
              <label>Anrede <span class="sm-required">*</span></label>
              <select id="sm-salutation" required>
                <option value="">Bitte wählen</option>
                <option value="male">Herr</option>
                <option value="female">Frau</option>
                <option value="diverse">Divers</option>
              </select>
            </div>
            <div class="sm-form-group">
              <label>Titel (optional)</label>
              <input type="text" id="sm-title" placeholder="Dr., Prof., ...">
            </div>
          </div>
          <div class="sm-form-row">
            <div class="sm-form-group">
              <label>Vorname <span class="sm-required">*</span></label>
              <input type="text" id="sm-firstname" placeholder="Max" required>
            </div>
            <div class="sm-form-group">
              <label>Nachname <span class="sm-required">*</span></label>
              <input type="text" id="sm-lastname" placeholder="Mustermann" required>
            </div>
          </div>
          <div class="sm-form-row-3">
            <div class="sm-form-group">
              <label>Geburtsdatum <span class="sm-required">*</span></label>
              <input type="date" id="sm-birthdate" required>
            </div>
            <div class="sm-form-group">
              <label>Geburtsort</label>
              <input type="text" id="sm-birthplace" placeholder="Berlin">
            </div>
            <div class="sm-form-group">
              <label>Nationalität <span class="sm-required">*</span></label>
              <select id="sm-nationality" required>
                <option value="">Bitte wählen</option>
                <option value="DE">Deutsch</option>
                <option value="AT">Österreich</option>
                <option value="CH">Schweiz</option>
                <option value="IT">Italienisch</option>
                <option value="ES">Spanisch</option>
                <option value="FR">Französisch</option>
                <option value="NL">Niederländisch</option>
                <option value="PL">Polnisch</option>
                <option value="TR">Türkisch</option>
                <option value="GB">Britisch</option>
                <option value="US">Amerikanisch</option>
                <option value="OTHER">Andere</option>
              </select>
            </div>
          </div>
        </div>
        
        <!-- Address -->
        <div class="sm-form-section">
          <div class="sm-form-section-title">📍 Adresse</div>
          <div class="sm-form-row">
            <div class="sm-form-group">
              <label>Straße</label>
              <input type="text" id="sm-street" placeholder="Musterstraße">
            </div>
            <div class="sm-form-group">
              <label>Hausnummer</label>
              <input type="text" id="sm-housenumber" placeholder="42a">
            </div>
          </div>
          <div class="sm-form-row-3">
            <div class="sm-form-group">
              <label>PLZ</label>
              <input type="text" id="sm-postalcode" placeholder="10115">
            </div>
            <div class="sm-form-group">
              <label>Stadt</label>
              <input type="text" id="sm-city" placeholder="Berlin">
            </div>
            <div class="sm-form-group">
              <label>Land</label>
              <input type="text" id="sm-country" placeholder="Deutschland" value="Deutschland">
            </div>
          </div>
        </div>
        
        <!-- Contact -->
        <div class="sm-form-section">
          <div class="sm-form-section-title">📧 Kontakt</div>
          <div class="sm-form-row">
            <div class="sm-form-group">
              <label>E-Mail <span class="sm-required">*</span></label>
              <input type="email" id="sm-email" placeholder="max@example.de" required>
            </div>
            <div class="sm-form-group">
              <label>Telefon</label>
              <input type="tel" id="sm-phone" placeholder="+49 170 1234567">
            </div>
          </div>
        </div>
        
        <div class="sm-total-row">
          <span>Gesamtpreis</span>
          <span style="color:#10b981;font-size:1.3rem;">${formatPrice(listing.askingPriceCents)}</span>
        </div>
        <button class="sm-checkout-btn" id="sm-confirm-btn">Jetzt kaufen</button>
        <p class="sm-privacy-note">Deine Daten werden verschlüsselt übertragen und nur für die Buchungsabwicklung verwendet.</p>
      </div>
    `;

    document.body.appendChild(overlay);
    overlay.querySelector('.sm-modal-close').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    overlay.querySelector('#sm-confirm-btn').onclick = async () => {
      const btn = overlay.querySelector('#sm-confirm-btn');
      
      const salutation = overlay.querySelector('#sm-salutation').value;
      const title = overlay.querySelector('#sm-title').value.trim();
      const firstName = overlay.querySelector('#sm-firstname').value.trim();
      const lastName = overlay.querySelector('#sm-lastname').value.trim();
      const birthDate = overlay.querySelector('#sm-birthdate').value;
      const birthPlace = overlay.querySelector('#sm-birthplace').value.trim();
      const nationality = overlay.querySelector('#sm-nationality').value;
      const street = overlay.querySelector('#sm-street').value.trim();
      const houseNumber = overlay.querySelector('#sm-housenumber').value.trim();
      const postalCode = overlay.querySelector('#sm-postalcode').value.trim();
      const city = overlay.querySelector('#sm-city').value.trim();
      const country = overlay.querySelector('#sm-country').value.trim();
      const email = overlay.querySelector('#sm-email').value.trim();
      const phone = overlay.querySelector('#sm-phone').value.trim();

      if (!salutation || !firstName || !lastName || !birthDate || !nationality || !email) {
        alert('Bitte alle Pflichtfelder ausfüllen');
        return;
      }
      if (!email.includes('@')) {
        alert('Bitte eine gültige E-Mail-Adresse eingeben');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Wird verarbeitet...';

      try {
        await createTransfer(listing.id, {
          salutation, title, firstName, lastName, birthDate, birthPlace,
          nationality, street, houseNumber, postalCode, city, country,
          email, phone
        }, apiKey);
        
        const modal = overlay.querySelector('.sm-modal');
        modal.innerHTML = `
          <div class="sm-success">
            <div class="sm-success-icon">✅</div>
            <h2>Anfrage gesendet!</h2>
            <p>Deine Anfrage wurde erfolgreich übermittelt. Die Reiseagentur wird sich in Kürze bei dir melden.</p>
            <button class="sm-checkout-btn" style="margin-top:20px;">Schließen</button>
          </div>
        `;
        modal.querySelector('.sm-checkout-btn').onclick = () => overlay.remove();
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Jetzt kaufen';
        alert('Fehler: ' + err.message);
      }
    };
  }

  function renderListing(listing, apiKey) {
    const card = document.createElement('div');
    card.className = 'sm-listing-card';

    const boardLabels = { AI: 'All Inclusive', HP: 'Halbpension', BB: 'Frühstück', SC: 'Selbstversorgung' };
    const transferLabels = { PRIVAT: 'Privater Transfer inklusive', SHUTTLE: 'Shuttle-Transfer inklusive', SELBST: 'Eigene Anreise' };

    card.innerHTML = `
      <div class="sm-listing-header">
        <div>
          <h3 class="sm-destination">✈️ ${listing.destination}</h3>
          <div class="sm-travel-dates">${formatDate(listing.departureDate)} — ${formatDate(listing.returnDate)}</div>
        </div>
        <div class="sm-price-badge">
          <span>${formatPrice(listing.originalPriceCents)}</span>
          ${formatPrice(listing.askingPriceCents)}
        </div>
      </div>
      
      <div class="sm-listing-body">
        ${listing.departureAirport ? `
        <div class="sm-section">
          <div class="sm-section-title">✈️ Flug</div>
          <div class="sm-flight-grid">
            <div class="sm-flight-endpoint">
              <div class="sm-flight-city">${listing.departureAirport.split('(')[0].trim()}</div>
              <div class="sm-flight-airport">${listing.departureAirport.match(/\(([^)]+)\)/)?.[1] || ''}</div>
              <div class="sm-flight-time">${listing.flightOutboundTime || ''}</div>
              <div class="sm-flight-date">${formatDate(listing.flightOutboundDate)}</div>
            </div>
            <div class="sm-flight-route">
              <div class="sm-flight-line"></div>
              <div class="sm-flight-number">${listing.airline} ${listing.flightNumber}</div>
            </div>
            <div class="sm-flight-endpoint">
              <div class="sm-flight-city">${listing.arrivalAirport.split('(')[0].trim()}</div>
              <div class="sm-flight-airport">${listing.arrivalAirport.match(/\(([^)]+)\)/)?.[1] || ''}</div>
              <div class="sm-flight-time">${listing.flightOutboundTime || ''}</div>
              <div class="sm-flight-date">${formatDate(listing.flightOutboundDate)}</div>
            </div>
          </div>
          ${listing.flightReturnDate ? `
          <div class="sm-return-flight sm-flight-grid">
            <div class="sm-flight-endpoint">
              <div class="sm-flight-city">${listing.arrivalAirport.split('(')[0].trim()}</div>
              <div class="sm-flight-airport">${listing.arrivalAirport.match(/\(([^)]+)\)/)?.[1] || ''}</div>
              <div class="sm-flight-time">${listing.flightReturnTime || ''}</div>
              <div class="sm-flight-date">${formatDate(listing.flightReturnDate)}</div>
            </div>
            <div class="sm-flight-route">
              <div class="sm-flight-line"></div>
              <div class="sm-flight-number">${listing.flightNumber}</div>
            </div>
            <div class="sm-flight-endpoint">
              <div class="sm-flight-city">${listing.departureAirport.split('(')[0].trim()}</div>
              <div class="sm-flight-airport">${listing.departureAirport.match(/\(([^)]+)\)/)?.[1] || ''}</div>
              <div class="sm-flight-time">${listing.flightReturnTime || ''}</div>
              <div class="sm-flight-date">${formatDate(listing.flightReturnDate)}</div>
            </div>
          </div>
          ` : ''}
          ${listing.baggage ? `<div class="sm-baggage">${listing.baggage}</div>` : ''}
        </div>
        ` : ''}
        
        ${listing.hotelName ? `
        <div class="sm-section">
          <div class="sm-section-title">🏨 Hotel</div>
          <div class="sm-hotel-card">
            <div class="sm-hotel-header">
              <div class="sm-hotel-name">${listing.hotelName}</div>
              <div class="sm-hotel-stars">${getStars(listing.hotelStars)}</div>
            </div>
            ${listing.hotelAddress ? `
            <div class="sm-hotel-address">
              📍 ${listing.hotelAddress}
              ${listing.googleMapsLink ? `<br><a href="${listing.googleMapsLink}" target="_blank" rel="noopener">📍 Auf Google Maps anzeigen</a>` : ''}
            </div>
            ` : ''}
            <div class="sm-room-info">
              ${listing.roomCategory ? `<span class="sm-tag">🛏️ ${listing.roomCategory}</span>` : ''}
              ${listing.boardType ? `<span class="sm-tag board-tag">🍽️ ${boardLabels[listing.boardType] || listing.boardType}</span>` : ''}
            </div>
            ${listing.hotelMapEmbed ? `<iframe class="sm-map-embed" src="${listing.hotelMapEmbed}" loading="lazy"></iframe>` : ''}
          </div>
        </div>
        ` : ''}
        
        ${listing.transferIncluded ? `
        <div class="sm-section">
          <div class="sm-section-title">🚐 Transfer</div>
          <div class="sm-transfer-info">
            ${transferLabels[listing.transferType] || 'Transfer inklusive'}
          </div>
        </div>
        ` : ''}
        
        ${listing.sellerReason ? `
        <div class="sm-seller-trust">
          ${listing.sellerReason ? `<div class="sm-seller-reason">"${listing.sellerReason}"</div>` : ''}
        </div>
        ` : ''}
      </div>
      
      <div class="sm-price-footer">
        <div class="sm-total-price">
          <span>${formatPrice(listing.originalPriceCents)}</span>
          ${formatPrice(listing.askingPriceCents)}
        </div>
        <button class="sm-buy-btn" data-listing-id="${listing.id}">Jetzt kaufen</button>
      </div>
    `;

    card.querySelector('.sm-buy-btn').onclick = () => showBuyModal(listing, apiKey);
    return card;
  }

  function renderListings(listings, container, apiKey) {
    container.innerHTML = '';
    if (listings.length === 0) {
      container.innerHTML = `<div class="sm-empty"><p>Keine Reisen verfügbar</p></div>`;
      return;
    }
    listings.forEach(listing => container.appendChild(renderListing(sanitizeListing(listing), apiKey)));
  }

  function renderError(container, message) {
    container.innerHTML = `<div class="sm-error">${message}</div>`;
  }

  function renderLoading(container) {
    container.innerHTML = `<div class="sm-loading">Lädt Reisen...</div>`;
  }

  function init() {
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    const widgets = document.querySelectorAll('[data-sm-org]');
    
    widgets.forEach(container => {
      const org = container.dataset.smOrg;
      const title = container.dataset.smTitle || 'Reisen zum Verkauf';
      const subtitle = container.dataset.smSubtitle || 'Günstige stornierte Reisen direkt vom Veranstalter';
      const apiKey = container.dataset.smApiKey || window.STORNOMATCH_API_KEY || '';

      container.innerHTML = `
        <div class="sm-widget">
          <div class="sm-widget-header">
            <h2 class="sm-widget-title">${title}</h2>
            <p class="sm-widget-subtitle">${subtitle}</p>
          </div>
          <div class="sm-widget-content"></div>
        </div>
      `;

      const content = container.querySelector('.sm-widget-content');
      renderLoading(content);

      fetchListings(org)
        .then(listings => renderListings(listings, content, apiKey))
        .catch(err => {
          console.error('Widget error:', err);
          renderError(content, 'Fehler beim Laden der Reisen. Bitte später erneut versuchen.');
        });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.StornoMatch = { render: init };
})();
