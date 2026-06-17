import nodemailer from 'nodemailer';

// In production, use Resend or similar
// For now, use a mock/log transport
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  } : undefined
});

// ─── Send Notification ───
export async function sendNotification({ to, template, data }) {
  const templates = {
    transfer_received: {
      subject: 'Neue Buchungsübertragung - StornoMatch',
      text: `
Hallo ${data.organizationName},

Eine neue Buchungsübertragung wartet auf Ihre Bestätigung.

Details:
- Reiseziel: ${data.destination}
- Abreisedatum: ${new Date(data.departureDate).toLocaleDateString('de-DE')}
- Betrag: €${data.amountEur}
- Transfer-ID: ${data.transferId}

Bitte loggen Sie sich in Ihr Dashboard ein, um die Übertragung zu bestätigen oder abzulehnen.

Mit freundlichen Grüßen,
Ihr StornoMatch Team
      `.trim()
    },
    transfer_completed: {
      subject: 'Buchungsübertragung abgeschlossen',
      text: `
Hallo,

die Buchungsübertragung wurde erfolgreich abgeschlossen.
Der Betrag wird in den kommenden Tagen auf Ihr Konto überwiesen.

Transfer-ID: ${data.transferId}

Mit freundlichen Grüßen,
Ihr StornoMatch Team
      `.trim()
    },
    transfer_rejected: {
      subject: 'Buchungsübertragung abgelehnt',
      text: `
Hallo,

leider wurde die Buchungsübertragung abgelehnt.
Der volle Betrag wurde bereits an den Käufer zurückerstattet.

Transfer-ID: ${data.transferId}

Bei Fragen wenden Sie sich bitte an den Reiseveranstalter.

Mit freundlichen Grüßen,
Ihr StornoMatch Team
      `.trim()
    },
    listing_created: {
      subject: 'Ihre Reise wurde veröffentlicht',
      text: `
Hallo ${data.sellerName},

Ihre Reise "${data.destination}" wurde erfolgreich auf dem Marktplatz veröffentlicht.

- Angebotspreis: €${data.askingPriceEur}
- Gültig bis: ${new Date(data.expiresAt).toLocaleDateString('de-DE')}

Sie erhalten eine Benachrichtigung, sobald sich ein Käufer gefunden hat.

Mit freundlichen Grüßen,
Ihr StornoMatch Team
      `.trim()
    }
  };

  const emailTemplate = templates[template];

  if (!emailTemplate) {
    console.warn(`Unknown email template: ${template}`);
    return;
  }

  try {
    // In development, just log
    if (process.env.NODE_ENV !== 'production') {
      console.log('📧 Email would be sent:', {
        to,
        subject: emailTemplate.subject,
        preview: emailTemplate.text.substring(0, 100)
      });
      return { sent: true, mock: true };
    }

    // In production, send via Resend/SMTP
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@stornomatch.com',
      to,
      subject: emailTemplate.subject,
      text: emailTemplate.text
    });

    return { sent: true };
  } catch (err) {
    console.error('Email send error:', err);
    return { sent: false, error: err.message };
  }
}
