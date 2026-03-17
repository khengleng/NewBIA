import { Resend } from 'resend';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY || 're_mock_key_for_startup_check');

const FROM_EMAIL = process.env.EMAIL_FROM || 'contact@cambobia.com';
const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://www.cambobia.com').replace(/\/$/, '');

/**
 * Email Templates
 */

// Welcome email for new users
export async function sendWelcomeEmail(to: string, userName: string, userRole: string) {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: 'Welcome to Boutique Advisory Platform!',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to BIA Platform!</h1>
              </div>
              <div class="content">
                <h2>Hello ${userName}!</h2>
                <p>Thank you for joining the Boutique Advisory Platform as a <strong>${userRole}</strong>.</p>
                <p>We're excited to have you on board. Our platform connects SMEs with investors through expert advisory services.</p>
                <p>Here's what you can do next:</p>
                <ul>
                  <li>Complete your profile</li>
                  <li>Explore available opportunities</li>
                  <li>Connect with other members</li>
                </ul>
                <a href="${FRONTEND_URL}/dashboard" class="button">Go to Dashboard</a>
                <p>If you have any questions, feel free to reach out to our support team.</p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} Boutique Advisory Platform. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Error sending welcome email:', error);
      return { success: false, error };
    }

    console.log('✅ Welcome email sent to:', to);
    return { success: true, data };
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    return { success: false, error };
  }
}

// New match notification
export async function sendMatchNotification(
  to: string,
  userName: string,
  matchName: string,
  matchType: 'SME' | 'INVESTOR',
  matchScore: number
) {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `New Match Found: ${matchName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .match-score { font-size: 48px; font-weight: bold; color: #667eea; text-align: center; margin: 20px 0; }
              .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎯 New Match Found!</h1>
              </div>
              <div class="content">
                <h2>Hello ${userName}!</h2>
                <p>We found a great match for you:</p>
                <h3>${matchName}</h3>
                <p>Type: <strong>${matchType}</strong></p>
                <div class="match-score">${matchScore}% Match</div>
                <p>This match was identified based on your preferences and profile. We think you'll find this opportunity interesting!</p>
                <a href="${FRONTEND_URL}/matchmaking" class="button">View Match Details</a>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} Boutique Advisory Platform. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Error sending match notification:', error);
      return { success: false, error };
    }

    console.log('✅ Match notification sent to:', to);
    return { success: true, data };
  } catch (error) {
    console.error('Failed to send match notification:', error);
    return { success: false, error };
  }
}

// Deal update notification
export async function sendDealUpdateNotification(
  to: string,
  userName: string,
  dealTitle: string,
  updateType: 'PUBLISHED' | 'FUNDED' | 'CLOSED' | 'DOCUMENT_UPLOADED'
) {
  const updateMessages = {
    PUBLISHED: 'A new deal has been published',
    FUNDED: 'has been successfully funded',
    CLOSED: 'has been closed',
    DOCUMENT_UPLOADED: 'New document uploaded to',
  };

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `Deal Update: ${dealTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>📊 Deal Update</h1>
              </div>
              <div class="content">
                <h2>Hello ${userName}!</h2>
                <p>${updateMessages[updateType]}: <strong>${dealTitle}</strong></p>
                <a href="${FRONTEND_URL}/deals" class="button">View Deal</a>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} Boutique Advisory Platform. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Error sending deal update notification:', error);
      return { success: false, error };
    }

    console.log('✅ Deal update notification sent to:', to);
    return { success: true, data };
  } catch (error) {
    console.error('Failed to send deal update notification:', error);
    return { success: false, error };
  }
}

// Booking confirmation
export async function sendBookingConfirmation(
  to: string,
  userName: string,
  serviceName: string,
  advisorName: string,
  bookingDate: Date
) {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `Booking Confirmed: ${serviceName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .booking-details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
              .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>✅ Booking Confirmed</h1>
              </div>
              <div class="content">
                <h2>Hello ${userName}!</h2>
                <p>Your booking has been confirmed:</p>
                <div class="booking-details">
                  <p><strong>Service:</strong> ${serviceName}</p>
                  <p><strong>Advisor:</strong> ${advisorName}</p>
                  <p><strong>Date:</strong> ${bookingDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}</p>
                </div>
                <a href="${FRONTEND_URL}/calendar" class="button">View in Calendar</a>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} Boutique Advisory Platform. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Error sending booking confirmation:', error);
      return { success: false, error };
    }

    console.log('✅ Booking confirmation sent to:', to);
    return { success: true, data };
  } catch (error) {
    console.error('Failed to send booking confirmation:', error);
    return { success: false, error };
  }
}

// Email Verification
export async function sendVerificationEmail(to: string, verificationToken: string) {
  const verificationUrl = `${FRONTEND_URL}/auth/verify-email?token=${encodeURIComponent(verificationToken)}`;

  if (!process.env.RESEND_API_KEY) {
    console.error('❌ RESEND_API_KEY is missing. Email will NOT be sent.');
    return { success: false, error: 'API Key missing' };
  }

  try {
    console.log(`📧 Attempting to send verification email to: ${to} using ${FROM_EMAIL}`);
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: 'Verify Your Email Address',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .button { display: inline-block; padding: 12px 30px; background: #667eea !important; color: white !important; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>✅ Verify Email</h1>
              </div>
              <div class="content">
                <p>Welcome to Boutique Advisory Platform!</p>
                <p>Please click the button below to verify your email address and activate your account:</p>
                <div style="text-align: center;">
                  <a href="${verificationUrl}" class="button" style="color: white;">Verify Email</a>
                </div>
                <p>Or copy and paste this link in your browser:</p>
                <p style="font-size: 11px; color: #999;">${verificationUrl}</p>
                <p>If you didn't create an account, you can safely ignore this email.</p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} Boutique Advisory Platform. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('❌ Resend API Error:', error);
      return { success: false, error };
    }

    console.log('✅ Verification email sent successfully. ID:', data?.id);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Failed to send verification email exception:', error);
    return { success: false, error };
  }
}

// Password reset email
export async function sendPasswordResetEmail(to: string, resetToken: string) {
  const resetUrl = `${FRONTEND_URL}/auth/reset-password?token=${encodeURIComponent(resetToken)}`;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: 'Reset Your Password',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🔐 Password Reset</h1>
              </div>
              <div class="content">
                <p>You requested to reset your password.</p>
                <p>Click the button below to create a new password:</p>
                <a href="${resetUrl}" class="button">Reset Password</a>
                <div class="warning">
                  <p><strong>⚠️ Security Notice:</strong></p>
                  <p>This link will expire in 1 hour. If you didn't request this, please ignore this email.</p>
                </div>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} Boutique Advisory Platform. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Error sending password reset email:', error);
      return { success: false, error };
    }

    console.log('✅ Password reset email sent to:', to);
    return { success: true, data };
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return { success: false, error };
  }
}

// Generic notification email
export async function sendNotificationEmail(
  to: string,
  subject: string,
  message: string,
  actionUrl?: string,
  actionText?: string
) {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: subject,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>📬 Notification</h1>
              </div>
              <div class="content">
                <p>${message}</p>
                ${actionUrl && actionText ? `<a href="${actionUrl}" class="button">${actionText}</a>` : ''}
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} Boutique Advisory Platform. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Error sending notification email:', error);
      return { success: false, error };
    }

    console.log('✅ Notification email sent to:', to);
    return { success: true, data };
  } catch (error) {
    console.error('Failed to send notification email:', error);
    return { success: false, error };
  }
}
// Notify advisor of new booking
export async function sendNewBookingNotification(
  advisorEmail: string,
  advisorName: string,
  clientName: string,
  serviceName: string,
  bookingDate: Date,
  notes?: string
) {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [advisorEmail],
      subject: `New Booking Request: ${clientName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .card { background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #667eea; margin: 20px 0; }
              .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>📅 New Booking Request</h1>
              </div>
              <div class="content">
                <h2>Hello ${advisorName},</h2>
                <p>You have received a new booking request from <strong>${clientName}</strong>.</p>
                <div class="card">
                  <p><strong>Service:</strong> ${serviceName}</p>
                  <p><strong>Date:</strong> ${bookingDate.toLocaleDateString()} ${bookingDate.toLocaleTimeString()}</p>
                  ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
                </div>
                <p>Please log in to your dashboard to review and confirm this booking.</p>
                <a href="${FRONTEND_URL}/advisory" class="button">View Booking</a>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} Boutique Advisory Platform. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Error sending advisor notification:', error);
      return { success: false, error };
    }
    return { success: true, data };
  } catch (error) {
    console.error('Failed to send advisor notification:', error);
    return { success: false, error };
  }
}

// Payment Receipt
export async function sendPaymentReceiptEmail(
  to: string,
  userName: string,
  amount: number,
  description: string,
  transactionId: string
) {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `Payment Receipt: $${amount}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #2d3748; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .receipt { background: white; padding: 20px; border: 1px dashed #cbd5e0; margin: 20px 0; }
              .total { font-size: 24px; font-weight: bold; color: #2d3748; margin-top: 10px; border-top: 2px solid #e2e8f0; padding-top: 10px; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Receipt</h1>
              </div>
              <div class="content">
                <h2>Hello ${userName},</h2>
                <p>Thank you for your payment. Here is your receipt:</p>
                <div class="receipt">
                  <p><strong>Description:</strong> ${description}</p>
                  <p><strong>Transaction ID:</strong> ${transactionId}</p>
                  <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                  <div class="total">
                    Total: $${amount.toFixed(2)}
                  </div>
                </div>
                <p>If you have any questions about this charge, please reply to this email.</p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} Boutique Advisory Platform. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Error sending receipt:', error);
      return { success: false, error };
    }
    return { success: true, data };
  } catch (error) {
    console.error('Failed to send receipt:', error);
    return { success: false, error };
  }
}
