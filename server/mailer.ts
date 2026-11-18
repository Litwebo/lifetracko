import nodemailer from 'nodemailer';

let transporter: any = null;

export function getMailerTransporter() {
  const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER || 'lifetracko0@gmail.com';
  const rawPass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || 'wfjm sene rxil upww';
  const gmailPass = rawPass.replace(/\s+/g, '');

  if (!gmailUser || !gmailPass) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
    });
  }

  return transporter;
}

export async function sendPasswordResetCodeEmail(recipientEmail: string, recipientName: string, code: string): Promise<{ sent: boolean; message?: string }> {
  const mailer = getMailerTransporter();
  const gmailUser = 'lifetracko0@gmail.com';

  if (!mailer) {
    console.log(`[MAILER INFO] SMTP credentials not available.`);
    return { sent: false, message: 'SMTP credentials not available.' };
  }

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; background-color: #0f172a; border-radius: 16px; color: #f8fafc;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="font-size: 24px; font-weight: 800; color: #10b981; margin: 0;">Life<span style="color: #818cf8;">Tracko</span></h1>
        <p style="font-size: 12px; color: #94a3b8; margin-top: 4px;">Smart Nutrition & Expense Management</p>
      </div>
      <div style="background-color: #1e293b; border-radius: 12px; padding: 20px; border: 1px solid #334155;">
        <p style="font-size: 14px; color: #cbd5e1; margin-top: 0;">Hello <strong>${recipientName || 'Member'}</strong>,</p>
        <p style="font-size: 14px; color: #cbd5e1;">You requested a password reset for your Life Tracko account (${recipientEmail}).</p>
        <p style="font-size: 13px; color: #94a3b8; margin-bottom: 8px;">Your 4-digit verification code is:</p>
        <div style="text-align: center; margin: 20px 0;">
          <span style="display: inline-block; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #34d399; background-color: #064e3b; padding: 12px 24px; border-radius: 12px; border: 1px solid #059669;">${code}</span>
        </div>
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">This code will expire in <strong>15 minutes</strong>.</p>
        <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">If you did not request this code, please ignore this email.</p>
      </div>
      <div style="text-align: center; margin-top: 20px; font-size: 11px; color: #64748b;">
        <p>Sent via Life Tracko Official Support (${gmailUser}) • Created by @litweb0</p>
      </div>
    </div>
  `;

  try {
    const info = await mailer.sendMail({
      from: `"Life Tracko Support" <${gmailUser}>`,
      to: recipientEmail,
      subject: `Life Tracko - Your 4-Digit Password Reset Verification Code`,
      text: `Hello ${recipientName || 'Member'},\n\nYour 4-digit password reset code for Life Tracko is: ${code}\n\nThis code expires in 15 minutes.\n\nSent from: lifetracko0@gmail.com`,
      html: htmlContent,
    });
    console.log(`[MAILER SUCCESS] Password reset code sent to ${recipientEmail}. MessageId: ${info.messageId}`);
    return { sent: true, message: `Email dispatched to ${recipientEmail}` };
  } catch (error: any) {
    console.error(`[MAILER ERROR] Primary SSL send failed for ${recipientEmail}:`, error?.message || error);
    // Fallback attempt via standard Gmail service transport
    try {
      const fallbackTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: gmailUser,
          pass: (process.env.GMAIL_APP_PASSWORD || 'wfjm sene rxil upww').replace(/\s+/g, ''),
        },
      });
      const info2 = await fallbackTransporter.sendMail({
        from: `"Life Tracko Support" <${gmailUser}>`,
        to: recipientEmail,
        subject: `Life Tracko - Your 4-Digit Password Reset Verification Code`,
        text: `Hello ${recipientName || 'Member'},\n\nYour 4-digit password reset code for Life Tracko is: ${code}\n\nThis code expires in 15 minutes.`,
        html: htmlContent,
      });
      console.log(`[MAILER FALLBACK SUCCESS] Sent via Gmail fallback to ${recipientEmail}. MessageId: ${info2.messageId}`);
      return { sent: true, message: `Email dispatched to ${recipientEmail}` };
    } catch (fallbackErr: any) {
      console.error(`[MAILER FALLBACK ERROR] Both primary and fallback email sending failed:`, fallbackErr?.message || fallbackErr);
      return { sent: false, message: fallbackErr.message || 'SMTP delivery failed' };
    }
  }
}

export async function sendSupportTicketEmail(ticketData: {
  ticketId: number | string;
  senderName: string;
  senderEmail: string;
  subject: string;
  category: string;
  message: string;
}): Promise<{ sent: boolean; message?: string }> {
  const mailer = getMailerTransporter();
  const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER || 'lifetracko0@gmail.com';
  const targetAdminEmail = 'lifetracko0@gmail.com';

  if (!mailer || !gmailUser) {
    console.log(`[MAILER INFO] Gmail SMTP credentials not configured. Support ticket #${ticketData.ticketId} logged in database.`);
    return { sent: false, message: 'SMTP credentials not configured.' };
  }

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; background-color: #0f172a; border-radius: 16px; color: #f8fafc;">
      <div style="text-align: center; margin-bottom: 24px; border-bottom: 1px solid #1e293b; padding-bottom: 16px;">
        <h1 style="font-size: 24px; font-weight: 800; color: #10b981; margin: 0;">Life<span style="color: #818cf8;">Tracko</span> Support Ticket</h1>
        <p style="font-size: 12px; color: #94a3b8; margin-top: 4px;">New User Help Request #${ticketData.ticketId}</p>
      </div>
      
      <div style="background-color: #1e293b; border-radius: 12px; padding: 20px; border: 1px solid #334155; margin-bottom: 16px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #cbd5e1;">
          <tr>
            <td style="padding: 6px 0; color: #94a3b8; width: 120px;"><strong>Ticket ID:</strong></td>
            <td style="padding: 6px 0; font-weight: 700; color: #34d399;">#${ticketData.ticketId}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #94a3b8;"><strong>From:</strong></td>
            <td style="padding: 6px 0; font-weight: 600; color: #ffffff;">${ticketData.senderName} &lt;${ticketData.senderEmail}&gt;</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #94a3b8;"><strong>Category:</strong></td>
            <td style="padding: 6px 0; color: #818cf8;">${ticketData.category}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #94a3b8;"><strong>Subject:</strong></td>
            <td style="padding: 6px 0; font-weight: 600; color: #ffffff;">${ticketData.subject}</td>
          </tr>
        </table>
      </div>

      <div style="background-color: #1e293b; border-radius: 12px; padding: 20px; border: 1px solid #334155;">
        <p style="font-size: 12px; color: #94a3b8; margin-top: 0; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">User Message:</p>
        <div style="font-size: 14px; color: #f8fafc; line-height: 1.6; white-space: pre-wrap; background-color: #0f172a; padding: 14px; border-radius: 8px; border: 1px solid #334155;">${ticketData.message}</div>
      </div>

      <div style="text-align: center; margin-top: 20px; font-size: 11px; color: #64748b;">
        <p>Reply directly to this email to respond to <strong>${ticketData.senderEmail}</strong>.</p>
        <p>Life Tracko Enterprise Help Desk • Created by @litweb0</p>
      </div>
    </div>
  `;

  try {
    await mailer.sendMail({
      from: `"Life Tracko Helpdesk" <${gmailUser}>`,
      to: targetAdminEmail,
      replyTo: ticketData.senderEmail,
      subject: `[Life Tracko Help Request #${ticketData.ticketId}] ${ticketData.subject} (${ticketData.senderName})`,
      text: `New Life Tracko Support Request #${ticketData.ticketId}\n\nFrom: ${ticketData.senderName} <${ticketData.senderEmail}>\nCategory: ${ticketData.category}\nSubject: ${ticketData.subject}\n\nMessage:\n${ticketData.message}`,
      html: htmlContent,
    });
    console.log(`[SUPPORT MAILER SUCCESS] Ticket #${ticketData.ticketId} sent to ${targetAdminEmail}`);
    return { sent: true, message: `Ticket delivered to ${targetAdminEmail}` };
  } catch (error: any) {
    console.error(`[SUPPORT MAILER ERROR] Failed to send support ticket email to ${targetAdminEmail}:`, error);
    return { sent: false, message: error.message || 'SMTP delivery failed' };
  }
}
