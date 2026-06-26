/**
 * StornoMatch Seller Widget
 * Form for sellers to submit a listing request
 */
(function() {
  'use strict';

  const API_BASE = window.STORNOMATCH_API || 'http://localhost:3000';

  const MIN_PRICE_PERCENT = 50;
  const MAX_PRICE_PERCENT = 100;

  // ─── DOM Elements ─────────────────────────────────────────
  const bookingRefInput = document.getElementById('booking-ref');
  const departureDateInput = document.getElementById('departure-date');
  const returnDateInput = document.getElementById('return-date');
  const firstNameInput = document.getElementById('first-name');
  const lastNameInput = document.getElementById('last-name');
  const emailInput = document.getElementById('email');
  const phoneInput = document.getElementById('phone');
  const hotelNameInput = document.getElementById('hotel-name');
  const hotelStarsInput = document.getElementById('hotel-stars');
  const originalPriceInput = document.getElementById('original-price');
  const wishPriceInput = document.getElementById('wish-price');
  const reasonInput = document.getElementById('reason');
  const submitBtn = document.getElementById('submit-btn');
  const errorMsg = document.getElementById('error-msg');
  const priceError = document.getElementById('price-error');
  const formView = document.getElementById('form-view');
  const successView = document.getElementById('success-view');

  // ─── Get org from URL param ───────────────────────────────
  const urlParams = new URLSearchParams(window.location.search);
  const org = urlParams.get('org') || 'mallorca';
  
  // Get API key from data attribute on widget container
  // or use a public demo key for seller submissions
  // API key from URL param, data attribute on body, or window variable
  const apiKey = urlParams.get('apiKey') 
    || document.body.getAttribute('data-seller-api-key')
    || window.STORNOMATCH_SELLER_API_KEY 
    || '';

  // ─── Validation ───────────────────────────────────────────
  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.add('visible');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function clearError() {
    errorMsg.classList.remove('visible');
  }

  function validatePrice() {
    const original = parseFloat(originalPriceInput.value);
    const wish = parseFloat(wishPriceInput.value);
    
    if (!original || !wish) {
      priceError.style.display = 'none';
      return true;
    }
    
    if (original <= 0 || wish <= 0) {
      priceError.textContent = 'Preise müssen größer als 0 sein';
      priceError.style.display = 'block';
      return false;
    }
    
    const minAllowed = original * (MIN_PRICE_PERCENT / 100);
    const maxAllowed = original * (MAX_PRICE_PERCENT / 100);
    
    if (wish < minAllowed) {
      priceError.textContent = `Wunschpreis muss mindestens ${(minAllowed).toFixed(2)} € (${MIN_PRICE_PERCENT}%) betragen`;
      priceError.style.display = 'block';
      return false;
    }
    if (wish > maxAllowed) {
      priceError.textContent = `Wunschpreis darf maximal ${(maxAllowed).toFixed(2)} € (${MAX_PRICE_PERCENT}%) betragen`;
      priceError.style.display = 'block';
      return false;
    }
    
    priceError.style.display = 'none';
    return true;
  }

  function validateForm() {
    clearError();
    
    if (!bookingRefInput.value.trim()) {
      showError('Bitte gib deine Buchungsnummer ein');
      return false;
    }
    if (!departureDateInput.value) {
      showError('Bitte gib dein Reisedatum ein');
      return false;
    }
    if (!returnDateInput.value) {
      showError('Bitte gib dein Rückreisedatum ein');
      return false;
    }
    if (new Date(returnDateInput.value) <= new Date(departureDateInput.value)) {
      showError('Rückreisedatum muss nach dem Hinflugdatum liegen');
      return false;
    }
    if (!firstNameInput.value.trim()) {
      showError('Bitte gib deinen Vornamen ein');
      return false;
    }
    if (!lastNameInput.value.trim()) {
      showError('Bitte gib deinen Nachnamen ein');
      return false;
    }
    if (!emailInput.value.trim() || !emailInput.value.includes('@')) {
      showError('Bitte gib eine gültige E-Mail-Adresse ein');
      return false;
    }
    if (!hotelNameInput.value.trim()) {
      showError('Bitte gib den Hotelnamen ein');
      return false;
    }
    if (!hotelStarsInput.value) {
      showError('Bitte wähle die Hotelsterne');
      return false;
    }
    if (!originalPriceInput.value || parseFloat(originalPriceInput.value) <= 0) {
      showError('Bitte gib deinen Originalreisepreis ein');
      return false;
    }
    if (!wishPriceInput.value || parseFloat(wishPriceInput.value) <= 0) {
      showError('Bitte gib deinen Wunschpreis ein');
      return false;
    }
    if (!validatePrice()) {
      showError('Bitte überprüfe deinen Wunschpreis');
      return false;
    }
    
    return true;
  }

  // ─── Submit ───────────────────────────────────────────────
  async function handleSubmit() {
    if (!validateForm()) return;
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Wird gesendet...';
    
    const originalPriceEur = parseFloat(originalPriceInput.value);
    const wishPriceEur = parseFloat(wishPriceInput.value);
    const originalPriceCents = Math.round(originalPriceEur * 100);
    const wishPriceCents = Math.round(wishPriceEur * 100);
    
    const sellerName = `${firstNameInput.value.trim()} ${lastNameInput.value.trim()}`;
    
    const payload = {
      originalBookingRef: bookingRefInput.value.trim(),
      destination: 'Zu ergänzen', // Admin füllt das ein
      departureDate: new Date(departureDateInput.value).toISOString(),
      returnDate: new Date(returnDateInput.value).toISOString(),
      originalPriceCents,
      askingPriceCents: wishPriceCents,
      sellerName,
      sellerEmail: emailInput.value.trim(),
      sellerPhone: phoneInput.value.trim() || null,
      sellerReason: reasonInput.value.trim() || null,
      hotelName: hotelNameInput.value.trim(),
      hotelStars: parseInt(hotelStarsInput.value),
      hotelAddress: 'Zu ergänzen', // Admin füllt das ein
      // Erstmal leer für Admin:
      departureAirport: '',
      arrivalAirport: '',
      flightOutboundDate: new Date(departureDateInput.value).toISOString(),
      flightOutboundTime: '00:00',
      flightReturnDate: new Date(returnDateInput.value).toISOString(),
      flightReturnTime: '00:00',
      airline: '',
      flightNumber: '',
      baggage: '',
      roomCategory: '',
      boardType: 'HP'
    };
    
    try {
      const headers = {
        'Content-Type': 'application/json'
      };
      if (apiKey) {
        headers['X-API-Key'] = apiKey;
      }
      
      const res = await fetch(`${API_BASE}/api/listings`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Ein Fehler ist aufgetreten');
      }
      
      // Show success
      formView.style.display = 'none';
      successView.style.display = 'block';
      
    } catch (err) {
      showError(err.message || 'Ein Fehler ist aufgetreten. Bitte versuche es später erneut.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Anfrage senden';
    }
  }

  // ─── Events ───────────────────────────────────────────────
  submitBtn.addEventListener('click', handleSubmit);
  
  // Live price validation
  originalPriceInput.addEventListener('input', validatePrice);
  wishPriceInput.addEventListener('input', validatePrice);
  
  // Prevent return date before departure date
  departureDateInput.addEventListener('change', () => {
    if (returnDateInput.value && new Date(returnDateInput.value) <= new Date(departureDateInput.value)) {
      returnDateInput.value = '';
    }
    returnDateInput.min = departureDateInput.value;
  });
  
  // Allow Enter key to submit
  document.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    });
  });
})();
