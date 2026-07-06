import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailMessage } from '../interfaces/mail.interface';
import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import { Resend, type CreateEmailOptions } from 'resend';
import { access, readFile } from 'fs/promises';
import * as path from 'path';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private _client: AxiosInstance;
  private domain: String | undefined;
  private resendClient?: Resend;
  private templateCache: Map<string, string> = new Map();
  private projectRoot?: string;
  constructor(private readonly configService: ConfigService) {
    const resendApiKey = this.configService.get<string>('RESEND_API_KEY');
    if (resendApiKey) {
      this.resendClient = new Resend(resendApiKey);
    }
  }

  private renderPriceBreakdownTable(breakdown: Record<string, any>): string {
    const fmt = (v: number) =>
      `&#8358;${Number(v).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
    const rows: [string, number][] = [
      ['Delivery Fee', breakdown.deliveryFee],
      ['Pickup Fee', breakdown.pickupFee],
      ['Packaging Fee', breakdown.packagingFee],
      ['Service Fee', breakdown.serviceFee],
      ['Payment Processing Fee', breakdown.nombaFee],
    ].filter(([, v]) => Number(v) > 0) as [string, number][];

    const rowsHtml = rows
      .map(
        ([label, value]) =>
          `<tr><td style="padding:3px 8px 3px 0;font-size:13px;color:#5B6B64;">${label}</td><td style="padding:3px 0;font-size:13px;color:#16352A;text-align:right;">${fmt(value)}</td></tr>`,
      )
      .join('');

    return `<table style="margin-top:12px;width:100%;border-top:1px solid #E8EDEB;padding-top:8px;">${rowsHtml}</table>`;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private getAppUrl(): string {
    return (
      this.configService.get<string>('APP_WEB_URL') ||
      this.configService.get<string>('FRONTEND_URL') ||
      this.configService.get<string>('WEB_APP_URL') ||
      'https://usedrova.app/'
    );
  }

  private getSupportEmail(): string {
    return (
      this.configService.get<string>('SUPPORT_EMAIL') || 'support@usedrova.app'
    );
  }

  private async getProjectRootDir(): Promise<string> {
    if (this.projectRoot) return this.projectRoot;

    let current = __dirname;

    for (let i = 0; i < 8; i += 1) {
      const candidate = path.resolve(current, 'package.json');
      try {
        await access(candidate);
        this.projectRoot = current;
        return current;
      } catch (_) {
        const parent = path.dirname(current);
        if (parent === current) break;
        current = parent;
      }
    }

    this.projectRoot = process.cwd();
    return this.projectRoot;
  }

  private async readTemplateFile(fileName: string): Promise<string> {
    const cached = this.templateCache.get(fileName);
    if (cached) return cached;

    const root = await this.getProjectRootDir();

    const candidates = [
      path.resolve(root, 'dist', 'templates', fileName),
      path.resolve(root, 'src', 'templates', fileName),
      path.resolve(__dirname, '..', 'templates', fileName),
    ];

    for (const candidate of candidates) {
      try {
        const html = await readFile(candidate, 'utf8');
        this.templateCache.set(fileName, html);
        return html;
      } catch (_) {
        continue;
      }
    }

    throw new InternalServerErrorException(
      `Email template not found: ${fileName}. Looked in: ${candidates.join(', ')}`,
    );
  }

  private renderPlaceholders(
    template: string,
    replacements: Record<string, string>,
  ): string {
    return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
      return Object.prototype.hasOwnProperty.call(replacements, key)
        ? replacements[key]
        : '';
    });
  }

  private buildOtpBoxes(otp: string): string {
    const digits = otp.replace(/\s+/g, '').slice(0, 8).split('');
    const cells = digits
      .map((d) => {
        const safe = this.escapeHtml(d);
        return `<td align="center" style="background:#F0F3F2;border:1px solid #E3EAE6;border-radius:10px;width:44px;height:52px;font-weight:800;font-size:18px;color:#0B3D2E;">${safe}</td>`;
      })
      .join('<td style="width:10px"></td>');

    return `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 14px 0 6px 0;">
        <tr>${cells}</tr>
      </table>
      <div style="font-size: 12px; color:#5B6B64;">This code expires in 10 minutes.</div>
    `;
  }

  private async renderTemplate(data: EmailMessage): Promise<string> {
    const subject = data.subject ?? 'Drova';
    const rawBody = data.text ?? '';
    const normalizedSubject = subject.toLowerCase();
    const preheader = rawBody.trim().slice(0, 140) || subject;

    const otp = rawBody.match(/\b\d{4,8}\b/)?.[0];

    const year = String(new Date().getFullYear());
    const footer_note = this.escapeHtml(
      `If you did not initiate this request, you can ignore this email or contact ${this.getSupportEmail()}.`,
    );

    const ctaUrl = this.getAppUrl();
    const cta_section = `
      <tr>
        <td class="px" style="padding: 0 26px 24px 26px;">
          <a class="btn" href="${this.escapeHtml(ctaUrl)}" style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; font-size: 14px; color:#FFFFFF;">{{cta_text}}</a>
        </td>
      </tr>
    `;

    const render = async (
      fileName: string,
      replacements: Record<string, string>,
    ) => {
      const template = await this.readTemplateFile(fileName);
      return this.renderPlaceholders(template, replacements);
    };

    if (
      normalizedSubject.includes('email validation') ||
      normalizedSubject.includes('verify')
    ) {
      const safeEmail = this.escapeHtml(data.to);
      const body_html = `<div style="font-size: 14px; color:#16352A;">We received a request to verify <strong>${safeEmail}</strong>.</div>`;
      const otp_boxes = otp ? this.buildOtpBoxes(otp) : '';
      return render('drova-email-verification.html', {
        subject: this.escapeHtml(subject),
        preheader: this.escapeHtml(preheader),
        heading: this.escapeHtml('Verify your email'),
        body_html,
        otp_boxes,
        cta_section: this.renderPlaceholders(cta_section, {
          cta_text: this.escapeHtml('Open Drova'),
        }),
        footer_note,
        year,
      });
    }

    if (
      normalizedSubject.includes('otp code') ||
      normalizedSubject.includes('otp')
    ) {
      const stripped = otp
        ? rawBody.replace(new RegExp(`\\b${otp}\\b`, 'g'), '').trim()
        : rawBody.trim();
      const body_html = stripped
        ? `<div style="font-size: 14px; color:#16352A;">${this.escapeHtml(stripped).replace(/\n/g, '<br />')}</div>`
        : `<div style="font-size: 14px; color:#16352A;">Here’s your verification code.</div>`;
      const otp_boxes = otp ? this.buildOtpBoxes(otp) : '';
      return render('drova-otp-code.html', {
        subject: this.escapeHtml(subject),
        preheader: this.escapeHtml(preheader),
        heading: this.escapeHtml('Your verification code'),
        body_html,
        otp_boxes,
        cta_section: this.renderPlaceholders(cta_section, {
          cta_text: this.escapeHtml('Open Drova'),
        }),
        footer_note,
        year,
      });
    }

    if (normalizedSubject.includes('welcome')) {
      const body_html = [
        `<div style="font-size: 14px; color:#16352A;">Your email has been verified successfully.</div>`,
        `<div style="margin-top: 10px; font-size: 14px; color:#16352A;">Next, complete your business profile to start receiving delivery requests.</div>`,
      ].join('');
      return render('drova-welcome.html', {
        subject: this.escapeHtml(subject),
        preheader: this.escapeHtml(preheader),
        heading: this.escapeHtml('Welcome to Drova'),
        body_html,
        cta_section: this.renderPlaceholders(cta_section, {
          cta_text: this.escapeHtml('Continue setup'),
        }),
        footer_note,
        year,
      });
    }

    const fallbackBodyHtml = this.escapeHtml(rawBody)
      .replace(/\n\n+/g, '\n\n')
      .split('\n\n')
      .map(
        (p) =>
          `<p style="margin: 0 0 10px 0;">${p.replace(/\n/g, '<br />')}</p>`,
      )
      .join('');

    return render('drova-generic.html', {
      subject: this.escapeHtml(subject),
      preheader: this.escapeHtml(preheader),
      heading: this.escapeHtml(subject),
      body_html: fallbackBodyHtml,
      cta_section: this.renderPlaceholders(cta_section, {
        cta_text: this.escapeHtml('Open Drova'),
      }),
      footer_note,
      year,
    });
  }

  async sendPaymentSuccessEmail(opts: {
    to: string;
    recipientName: string;
    referenceCode: string;
    amount: number;
    deliveryPin?: string;
  }): Promise<void> {
    const subject = 'Payment Successful — Your Delivery is Confirmed';
    const preheader = `Order ${opts.referenceCode} has been paid successfully.`;
    const year = String(new Date().getFullYear());
    const footer_note = this.escapeHtml(
      `If you have any questions, contact ${this.getSupportEmail()}.`,
    );
    const ctaUrl = this.getAppUrl();
    const cta_section = `
      <tr>
        <td class="px" style="padding: 0 26px 24px 26px;">
          <a class="btn" href="${this.escapeHtml(ctaUrl)}" style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; font-size: 14px; color:#FFFFFF;">Track Your Order</a>
        </td>
      </tr>
    `;

    let otp_section = '';
    if (opts.deliveryPin) {
      otp_section = this.buildOtpBoxes(opts.deliveryPin);
    }

    const body_html = [
      `<div style="font-size: 14px; color:#16352A;">Hi ${this.escapeHtml(opts.recipientName)},</div>`,
      `<div style="margin-top: 10px; font-size: 14px; color:#16352A;">Payment of <strong>&#8358;${opts.amount.toLocaleString()}</strong> for order <strong>${this.escapeHtml(opts.referenceCode)}</strong> was successful.</div>`,
      opts.deliveryPin
        ? `<div style="margin-top: 10px; font-size: 14px; color:#16352A;">Your delivery OTP is shown below. Please share this code with the rider upon delivery to confirm receipt.</div>`
        : `<div style="margin-top: 10px; font-size: 14px; color:#16352A;">Your delivery has been confirmed and is being processed.</div>`,
    ].join('');

    const template = await this.readTemplateFile('drova-payment-success.html');
    const html = this.renderPlaceholders(template, {
      subject: this.escapeHtml(subject),
      preheader: this.escapeHtml(preheader),
      heading: this.escapeHtml('Payment Confirmed'),
      body_html,
      otp_section,
      cta_section,
      footer_note,
      year,
    });

    await this.sendMail({ to: opts.to, subject, html });
  }

  async sendBusinessPaymentSuccessEmail(opts: {
    to: string;
    businessName: string;
    referenceCode: string;
    amount: number;
  }): Promise<void> {
    const subject = 'New Paid Order — Action Required';
    const preheader = `Order ${opts.referenceCode} has been paid successfully.`;
    const year = String(new Date().getFullYear());
    const footer_note = this.escapeHtml(
      `If you have any questions, contact ${this.getSupportEmail()}.`,
    );
    const ctaUrl = this.getAppUrl();
    const cta_section = `
      <tr>
        <td class="px" style="padding: 0 26px 24px 26px;">
          <a class="btn" href="${this.escapeHtml(ctaUrl)}" style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; font-size: 14px; color:#FFFFFF;">Open Dashboard</a>
        </td>
      </tr>
    `;

    const body_html = [
      `<div style="font-size: 14px; color:#16352A;">Hi ${this.escapeHtml(opts.businessName)},</div>`,
      `<div style="margin-top: 10px; font-size: 14px; color:#16352A;">A customer has successfully paid <strong>&#8358;${opts.amount.toLocaleString()}</strong> for order <strong>${this.escapeHtml(opts.referenceCode)}</strong>.</div>`,
      `<div style="margin-top: 10px; font-size: 14px; color:#16352A;">Please prepare the package and get it ready for pickup and dispatch.</div>`,
    ].join('');

    const template = await this.readTemplateFile('drova-payment-success.html');
    const html = this.renderPlaceholders(template, {
      subject: this.escapeHtml(subject),
      preheader: this.escapeHtml(preheader),
      heading: this.escapeHtml('New Paid Order'),
      body_html,
      otp_section: '',
      cta_section,
      footer_note,
      year,
    });

    await this.sendMail({ to: opts.to, subject, html });
  }

  async sendPaymentFailedEmail(opts: {
    to: string;
    recipientName: string;
    referenceCode: string;
    amount: number;
    reason?: string;
  }): Promise<void> {
    const subject = 'Payment Failed — Action Required';
    const preheader = `Payment for order ${opts.referenceCode} was not successful.`;
    const year = String(new Date().getFullYear());
    const footer_note = this.escapeHtml(
      `If you believe this is an error, contact ${this.getSupportEmail()}.`,
    );
    const ctaUrl = this.getAppUrl();
    const cta_section = `
      <tr>
        <td class="px" style="padding: 0 26px 24px 26px;">
          <a class="btn" href="${this.escapeHtml(ctaUrl)}" style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; font-size: 14px; color:#FFFFFF;">Retry Payment</a>
        </td>
      </tr>
    `;

    const reasonText = opts.reason
      ? `Reason: ${this.escapeHtml(opts.reason)}`
      : 'Please try again or use a different payment method.';

    const body_html = [
      `<div style="font-size: 14px; color:#16352A;">Hi ${this.escapeHtml(opts.recipientName)},</div>`,
      `<div style="margin-top: 10px; font-size: 14px; color:#16352A;">We were unable to process your payment of <strong>&#8358;${opts.amount.toLocaleString()}</strong> for order <strong>${this.escapeHtml(opts.referenceCode)}</strong>.</div>`,
      `<div style="margin-top: 10px; font-size: 14px; color:#5B6B64;">${reasonText}</div>`,
    ].join('');

    const template = await this.readTemplateFile('drova-payment-failed.html');
    const html = this.renderPlaceholders(template, {
      subject: this.escapeHtml(subject),
      preheader: this.escapeHtml(preheader),
      heading: this.escapeHtml('Payment Failed'),
      body_html,
      cta_section,
      footer_note,
      year,
    });

    await this.sendMail({ to: opts.to, subject, html });
  }

  async sendBusinessPaymentFailedEmail(opts: {
    to: string;
    businessName: string;
    referenceCode: string;
    amount: number;
    reason?: string;
  }): Promise<void> {
    const subject = 'Payment Failed — Order Not Confirmed';
    const preheader = `Payment for order ${opts.referenceCode} failed.`;
    const year = String(new Date().getFullYear());
    const footer_note = this.escapeHtml(
      `If you believe this is an error, contact ${this.getSupportEmail()}.`,
    );
    const ctaUrl = this.getAppUrl();
    const cta_section = `
      <tr>
        <td class="px" style="padding: 0 26px 24px 26px;">
          <a class="btn" href="${this.escapeHtml(ctaUrl)}" style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; font-size: 14px; color:#FFFFFF;">Open Dashboard</a>
        </td>
      </tr>
    `;

    const reasonText = opts.reason
      ? `Reason: ${this.escapeHtml(opts.reason)}`
      : 'The customer will need to retry payment to confirm this order.';

    const body_html = [
      `<div style="font-size: 14px; color:#16352A;">Hi ${this.escapeHtml(opts.businessName)},</div>`,
      `<div style="margin-top: 10px; font-size: 14px; color:#16352A;">We were unable to confirm payment of <strong>&#8358;${opts.amount.toLocaleString()}</strong> for order <strong>${this.escapeHtml(opts.referenceCode)}</strong>.</div>`,
      `<div style="margin-top: 10px; font-size: 14px; color:#5B6B64;">${reasonText}</div>`,
      `<div style="margin-top: 10px; font-size: 14px; color:#16352A;">You don't need to dispatch this order until payment is successful.</div>`,
    ].join('');

    const template = await this.readTemplateFile('drova-payment-failed.html');
    const html = this.renderPlaceholders(template, {
      subject: this.escapeHtml(subject),
      preheader: this.escapeHtml(preheader),
      heading: this.escapeHtml('Payment Failed'),
      body_html,
      cta_section,
      footer_note,
      year,
    });

    await this.sendMail({ to: opts.to, subject, html });
  }

  async sendInvoiceEmail(opts: {
    to: string;
    customerName: string;
    businessName: string;
    referenceCode: string;
    amount: number;
    paymentLink: string;
    note?: string;
    breakdown?: Record<string, any>;
  }): Promise<void> {
    const subject = `Invoice from ${opts.businessName} — Order ${opts.referenceCode}`;
    const preheader = `Your delivery invoice of ₦${opts.amount.toLocaleString()} is ready for payment.`;
    const year = String(new Date().getFullYear());
    const footer_note = this.escapeHtml(
      `If you have any questions, contact ${this.getSupportEmail()}.`,
    );

    const cta_section = `
      <tr>
        <td class="px" style="padding: 0 26px 24px 26px;">
          <a class="btn" href="${this.escapeHtml(opts.paymentLink)}" style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; font-size: 14px; color:#FFFFFF;">Pay Now</a>
        </td>
      </tr>
    `;

    const breakdownHtml = opts.breakdown
      ? this.renderPriceBreakdownTable(opts.breakdown)
      : '';

    const noteHtml = opts.note
      ? `<div style="margin-top: 10px; font-size: 14px; color:#5B6B64;">${this.escapeHtml(opts.note)}</div>`
      : '';

    const body_html = [
      `<div style="font-size: 14px; color:#16352A;">Hi ${this.escapeHtml(opts.customerName)},</div>`,
      `<div style="margin-top: 10px; font-size: 14px; color:#16352A;">${this.escapeHtml(opts.businessName)} has sent you an invoice for your delivery request (Order <strong>${this.escapeHtml(opts.referenceCode)}</strong>).</div>`,
      `<div style="margin-top: 10px; font-size: 16px; font-weight: bold; color:#16352A;">Amount Due: &#8358;${opts.amount.toLocaleString()}</div>`,
      breakdownHtml,
      noteHtml,
      `<div style="margin-top: 10px; font-size: 14px; color:#16352A;">Click the button below to complete your payment and confirm the delivery.</div>`,
    ].join('');

    const template = await this.readTemplateFile('drova-payment-success.html');
    const html = this.renderPlaceholders(template, {
      subject: this.escapeHtml(subject),
      preheader: this.escapeHtml(preheader),
      heading: this.escapeHtml('Invoice Ready'),
      body_html,
      otp_section: '',
      cta_section,
      footer_note,
      year,
    });

    await this.sendMail({ to: opts.to, subject, html });
  }

  async sendTrackingEmail(opts: {
    to: string;
    customerName: string;
    referenceCode: string;
  }): Promise<void> {
    const trackingUrl = `${this.getAppUrl()}/track/${opts.referenceCode}`;
    const subject = `Your Order Tracking Link — ${opts.referenceCode}`;
    const text = [
      `Hi ${opts.customerName},`,
      ``,
      `Here is your tracking link for order ${opts.referenceCode}:`,
      ``,
      trackingUrl,
      ``,
      `You can use this link at any time to check the status of your delivery.`,
      ``,
      `If you have any questions, please contact our support team.`,
    ].join('\n');

    await this.sendMail({ to: opts.to, subject, text });
  }

  async sendOrderStatusEmail(opts: {
    to: string;
    name: string;
    referenceCode: string;
    status: string;
    kind: 'sender' | 'recipient';
    businessName?: string;
    amount?: number;
    wasRefunded?: boolean;
    reason?: string;
  }): Promise<void> {
    const ref = opts.referenceCode;
    const business = opts.businessName ?? 'the business';
    const refundLine = opts.wasRefunded
      ? `A refund of ₦${(opts.amount ?? 0).toLocaleString()} is being processed and will be returned to your original payment method within 3–5 business days.`
      : `No payment was collected for this order.`;
    const reasonLine = opts.reason ? `\n\nReason: ${opts.reason}` : '';

    const COPY: Record<
      string,
      {
        sender?: { subject: string; body: string };
        recipient?: { subject: string; body: string };
      }
    > = {
      assigned: {
        sender: {
          subject: `Rider Assigned — Order ${ref}`,
          body: `Hi ${opts.name},\n\nGreat news! A rider has accepted your delivery order (${ref}) and will be heading to the pickup location shortly.\n\nYou'll receive another update once your package is on its way.`,
        },
        recipient: {
          subject: `Rider Assigned — Order ${ref}`,
          body: `Hi ${opts.name},\n\nA rider has been assigned to deliver your package (Order ${ref}). Expect your delivery soon.\n\nThe rider will contact you upon arrival.`,
        },
      },
      cancelled: {
        sender: {
          subject: `Your Order Has Been Cancelled — ${ref}`,
          body: `Hi ${opts.name},\n\nWe're writing to let you know that your delivery order (${ref}) placed with ${business} has been cancelled.${reasonLine}\n\n${refundLine}\n\nIf you have any questions, please reach out to ${business} directly or contact our support team.`,
        },
      },
      en_route_pickup: {
        sender: {
          subject: `Rider En Route — Order ${ref}`,
          body: `Hi ${opts.name},\n\nYour rider is on the way to the pickup location. Your package will be collected shortly.`,
        },
      },
      picked_up: {
        sender: {
          subject: `Package Picked Up — Order ${ref}`,
          body: `Hi ${opts.name},\n\nYour package has been picked up by the rider and is on its way to the recipient.`,
        },
        recipient: {
          subject: `Your Package is On the Way — Order ${ref}`,
          body: `Hi ${opts.name},\n\nA rider has collected your package and is heading your way. You'll receive another update when they're close.`,
        },
      },
      in_transit: {
        recipient: {
          subject: `Package In Transit — Order ${ref}`,
          body: `Hi ${opts.name},\n\nYour package is in transit and will arrive soon. The rider will contact you on arrival.`,
        },
      },
      arrived_at_delivery: {
        recipient: {
          subject: `Rider Has Arrived — Order ${ref}`,
          body: `Hi ${opts.name},\n\nThe rider has arrived at your delivery location. Please share your delivery PIN with the rider to confirm receipt.`,
        },
      },
      completed: {
        sender: {
          subject: `Delivery Confirmed — Order ${ref}`,
          body: `Hi ${opts.name},\n\nYour delivery (Order ${ref}) has been successfully completed. Thank you for using Drova!`,
        },
        recipient: {
          subject: `Delivery Confirmed — Order ${ref}`,
          body: `Hi ${opts.name},\n\nYou've received your package for order ${ref}. Thank you for using Drova!`,
        },
      },
    };

    const copy = COPY[opts.status]?.[opts.kind];
    if (!copy) return;

    await this.sendMail({
      to: opts.to,
      subject: copy.subject,
      text: copy.body,
    });
  }

  async sendNewOrderEmail(opts: {
    to: string;
    businessName: string;
    referenceCode: string;
    customerName: string;
  }): Promise<void> {
    const subject = `New Order Received — ${opts.referenceCode}`;
    const preheader = `${opts.customerName} has placed a new delivery request. Review and send an invoice to get started.`;
    const year = String(new Date().getFullYear());
    const dashboardUrl = `${this.getAppUrl()}/dashboard/orders`;

    const cta_section = `
      <tr>
        <td class="px" style="padding: 0 26px 24px 26px;">
          <a class="btn" href="${this.escapeHtml(dashboardUrl)}" style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; font-size: 14px; color:#FFFFFF;">View Order</a>
        </td>
      </tr>
    `;

    const body_html = [
      `<div style="font-size: 14px; color:#16352A;">Hi ${this.escapeHtml(opts.businessName)},</div>`,
      `<div style="margin-top: 10px; font-size: 14px; color:#16352A;">You have received a new delivery request from <strong>${this.escapeHtml(opts.customerName)}</strong>.</div>`,
      `<div style="margin-top: 10px; font-size: 14px; color:#16352A;">Order Reference: <strong>${this.escapeHtml(opts.referenceCode)}</strong></div>`,
      `<div style="margin-top: 10px; font-size: 14px; color:#16352A;">Log in to your dashboard to review the order details and send an invoice to the customer.</div>`,
    ].join('');

    const footer_note = this.escapeHtml(
      `If you have any questions, contact ${this.getSupportEmail()}.`,
    );

    const template = await this.readTemplateFile('drova-generic.html');
    const html = this.renderPlaceholders(template, {
      subject: this.escapeHtml(subject),
      preheader: this.escapeHtml(preheader),
      heading: 'New Delivery Request',
      body_html,
      cta_section,
      footer_note,
      year,
    });

    await this.sendMail({ to: opts.to, subject, html });
  }

  async sendMail(data: EmailMessage): Promise<any> {
    if (!data.html && data.text) {
      data.html = await this.renderTemplate(data);
    }

    if (this.resendClient) {
      const sender_email = this.getSupportEmail();
      const sender_name = 'Drova';
      const sender = `${sender_name}<${sender_email}>`;
      const payload: CreateEmailOptions = data.html
        ? ({
            from: sender,
            to: data.to,
            subject: data.subject,
            html: data.html,
            text: data.text ?? undefined,
          } as CreateEmailOptions)
        : ({
            from: sender,
            to: data.to,
            subject: data.subject,
            text: data.text ?? data.subject,
          } as CreateEmailOptions);

      const response: any = await this.resendClient.emails.send(payload);

      if (response?.error) {
        this.logger.error('Failed to send email', response.error);
        throw new Error(
          typeof response.error === 'string'
            ? response.error
            : ((response.error as any)?.message ?? 'Failed to send email'),
        );
      }

      this.logger.log(`Email sent successfully. ID: ${response.data?.id}`);
      return response;
    }
  }
}
