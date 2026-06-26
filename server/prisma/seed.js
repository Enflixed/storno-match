import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clean up existing data (idempotent seed)
  await prisma.transfer.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
  await prisma.apiKey.deleteMany();
  console.log('✓ Cleaned existing data');

  // Create test organization
  const org = await prisma.organization.create({
    data: {
      name: 'Reisebüro Mallorca Tours',
      subdomain: 'mallorca',
      contactEmail: 'info@mallorca-tours.de',
      contactName: 'Thomas Müller',
      stripeOnboarded: true,
      plan: 'PROFESSIONAL',
      minPricePercent: 50,
      maxPricePercent: 100,
      timeLockHours: 48
    }
  });
  console.log(`✅ Organization created: ${org.name} (${org.subdomain})`);

  // Create admin user
  const passwordHash = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.create({
    data: {
      email: 'admin@mallorca-tours.de',
      passwordHash,
      name: 'Thomas Müller',
      role: 'OWNER',
      organizationId: org.id
    }
  });
  console.log(`✅ Admin user created: ${admin.email} (password: admin123)`);

  // Create API key for widget
  const apiKeyPlain = 'sk_test_mallorca_widget_12345678';
  await prisma.apiKey.create({
    data: {
      organizationId: org.id,
      keyHash: crypto.createHash('sha256').update(apiKeyPlain).digest('hex'),
      keyPrefix: apiKeyPlain.substring(0, 8),
      name: 'Test Widget',
      active: true
    }
  });
  console.log(`✅ API Key created: ${apiKeyPlain}`);

  // Create sellers/customers
  const sellers = [
    { email: 'thomas@example.com', name: 'Thomas Müller' },
    { email: 'sarah@example.com', name: 'Sarah Klein' },
    { email: 'max@example.com', name: 'Max Weber' }
  ];

  for (const s of sellers) {
    await prisma.customer.create({
      data: {
        ...s,
        emailHash: crypto.createHash('sha256').update(s.email).digest('hex'),
        organizationId: org.id
      }
    });
  }
  console.log(`✅ ${sellers.length} sellers/customers created`);

  // Create sample listings (PENDING_APPROVAL so admin can approve)
  const listings = [
    {
      organizationId: org.id,
      originalBookingRef: 'RM-2026-001-A',
      destination: 'Mallorca, Spanien',
      departureDate: new Date('2026-07-15'),
      returnDate: new Date('2026-07-22'),
      originalPriceCents: 59900,
      askingPriceCents: 42000,
      description: 'Schöne 7-Tage Pauschalreise nach Mallorca',
      sellerNameAnonymous: 'Thomas M.',
      sellerEmailHash: crypto.createHash('sha256').update('thomas@example.com').digest('hex'),
      sellerReason: 'Terminkollision - leider doppelt gebucht',
      status: 'PENDING_APPROVAL',
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      // Flight
      departureAirport: 'München (MUC)',
      arrivalAirport: 'Palma de Mallorca (PMI)',
      flightOutboundDate: new Date('2026-07-15'),
      flightOutboundTime: '08:30',
      flightReturnDate: new Date('2026-07-22'),
      flightReturnTime: '18:45',
      airline: 'TUIfly',
      flightNumber: 'X3 1234',
      baggage: '1x23kg + Handgepäck',
      // Hotel
      hotelName: 'Hotel Bell Port',
      hotelStars: 4,
      hotelStarsVerified: 4,
      hotelAddress: 'Carrer de la Platja 45, 07660 Cala Rajada, Mallorca',
      roomCategory: 'Doppelzimmer, Meerblick, 28m²',
      boardType: 'AI',
      // Transfer
      transferIncluded: true,
      transferType: 'PRIVAT'
    },
    {
      organizationId: org.id,
      originalBookingRef: 'RM-2026-002-B',
      destination: 'Gran Canaria',
      departureDate: new Date('2026-08-01'),
      returnDate: new Date('2026-08-08'),
      originalPriceCents: 75000,
      askingPriceCents: 50000,
      description: '8 Tage Gran Canaria im 4* Hotel direkt am Strand',
      sellerNameAnonymous: 'Sarah K.',
      sellerEmailHash: crypto.createHash('sha256').update('sarah@example.com').digest('hex'),
      sellerReason: 'Urlaubsplanung geändert',
      status: 'PENDING_APPROVAL',
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      // Flight
      departureAirport: 'Frankfurt (FRA)',
      arrivalAirport: 'Las Palmas (LPA)',
      flightOutboundDate: new Date('2026-08-01'),
      flightOutboundTime: '06:00',
      flightReturnDate: new Date('2026-08-08'),
      flightReturnTime: '20:30',
      airline: 'Condor',
      flightNumber: 'DE 5678',
      baggage: '2x23kg + Handgepäck',
      // Hotel
      hotelName: 'Palm Beach Maspalomas',
      hotelStars: 4,
      hotelStarsVerified: null,
      hotelAddress: 'Avenida del Tirtecq 1, 35100 Maspalomas, Gran Canaria',
      roomCategory: 'Suite, Strandblick, 45m²',
      boardType: 'HP',
      // Transfer
      transferIncluded: true,
      transferType: 'SHUTTLE'
    },
    {
      organizationId: org.id,
      originalBookingRef: 'RM-2026-003-C',
      destination: 'Teneriffa',
      departureDate: new Date('2026-09-10'),
      returnDate: new Date('2026-09-17'),
      originalPriceCents: 45000,
      askingPriceCents: 35000,
      description: '7 Tage Teneriffa mit Direktflug',
      sellerNameAnonymous: 'Max W.',
      sellerEmailHash: crypto.createHash('sha256').update('max@example.com').digest('hex'),
      sellerReason: 'Familiennotfall - mussten kurzfristig absagen',
      status: 'ACTIVE', // Already approved for demo
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      // Flight
      departureAirport: 'Düsseldorf (DUS)',
      arrivalAirport: 'Teneriffa Süd (TFS)',
      flightOutboundDate: new Date('2026-09-10'),
      flightOutboundTime: '09:15',
      flightReturnDate: new Date('2026-09-17'),
      flightReturnTime: '19:00',
      airline: 'Eurowings',
      flightNumber: 'EW 2345',
      baggage: '1x23kg + Handgepäck',
      // Hotel
      hotelName: 'Paradores Tenerife',
      hotelStars: 3,
      hotelStarsVerified: 3,
      hotelAddress: 'Camino a la Degollada, 38300 La Orotava, Teneriffa',
      roomCategory: 'Standard, Bergblick, 24m²',
      boardType: 'BB',
      // Transfer
      transferIncluded: false,
      transferType: 'SELBST'
    }
  ];

  for (const listing of listings) {
    await prisma.listing.create({ data: listing });
  }
  console.log(`✅ ${listings.length} sample listings created`);

  // Create a sample transfer with full buyer data (PAID status)
  const tenerifeListing = listings.find(l => l.destination === 'Teneriffa');
  const sellerCustomer = sellers.find(s => s.email === 'max@example.com');

  // Create buyer customer with full data
  const buyerEmailHash = crypto.createHash('sha256').update('lisa.schmidt@web.de').digest('hex');
  const buyerCustomer = await prisma.customer.create({
    data: {
      email: 'lisa.schmidt@web.de',
      name: 'Lisa Schmidt',
      phone: '+491701234567',
      emailHash: buyerEmailHash,
      organizationId: org.id,
      gender: 'female',
      firstName: 'Lisa',
      lastName: 'Schmidt',
      birthDate: new Date('1992-03-15'),
      birthPlace: 'Hamburg',
      title: null,
      street: 'Hauptstraße',
      houseNumber: '23',
      postalCode: '20359',
      city: 'Hamburg',
      country: 'Deutschland',
      nationality: 'DE'
    }
  });

  const transfer = await prisma.transfer.create({
    data: {
      listingId: (await prisma.listing.findFirst({ where: { destination: 'Teneriffa' } })).id,
      organizationId: org.id,
      sellerId: (await prisma.customer.findUnique({ where: { emailHash: crypto.createHash('sha256').update('max@example.com').digest('hex') } })).id,
      sellerCustomerId: (await prisma.customer.findUnique({ where: { emailHash: crypto.createHash('sha256').update('max@example.com').digest('hex') } })).id,
      sellerEmailHash: crypto.createHash('sha256').update('max@example.com').digest('hex'),
      buyerId: buyerCustomer.id,
      buyerCustomerId: buyerCustomer.id,
      buyerEmailHash,
      amountCents: 35000,
      currency: 'EUR',
      platformFeeCents: 3900,
      creatorRoyaltyCents: 1750,
      sellerPayoutCents: 29350,
      stripePaymentIntentId: 'pi_demo_seed_abcdef12',
      status: 'PAID',
      reassignmentStatus: 'PENDING',
      paidAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
    }
  });
  console.log(`✅ Sample transfer created (PAID, ID: ${transfer.id.substring(0, 8)}...)`);

  console.log('\n🎉 Seed complete!');
  console.log('\n📋 Test credentials:');
  console.log('   Org subdomain: mallorca');
  console.log('   Admin Login: admin@mallorca-tours.de / admin123');
  console.log('   Widget API Key:', apiKeyPlain);
  console.log('\n📦 Listings: 2x PENDING_APPROVAL, 1x ACTIVE');
  console.log('\n🌐 Server should be running on http://localhost:3000');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
