import { websiteConfig } from '@/config/website';
import { getTemplate } from '@/mail';
import type {
  MailProvider,
  SendEmailResult,
  SendRawEmailParams,
  SendTemplateParams,
} from '@/mail/types';
import { Resend } from 'resend';

/**
 * Resend mail provider implementation
 *
 * docs:
 * https://mksaas.com/docs/email
 */
export class ResendProvider implements MailProvider {
  private resend: Resend;
  private from: string;

  /**
   * Initialize Resend provider with API key
   */
  constructor() {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not set.');
    }

    if (!websiteConfig.mail.fromEmail) {
      throw new Error(
        'Default from email address is not set in websiteConfig.'
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    this.resend = new Resend(apiKey);
    this.from = websiteConfig.mail.fromEmail;
  }

  /**
   * Get the provider name
   * @returns Provider name
   */
  public getProviderName(): string {
    return 'resend';
  }

  /**
   * Send an email using a template
   * @param params Parameters for sending a templated email
   * @returns Send result
   */
  public async sendTemplate(
    params: SendTemplateParams
  ): Promise<SendEmailResult> {
    const { to, template, context, locale } = params;

    try {
      // Get rendered template
      const mailTemplate = await getTemplate({
        template,
        context,
        locale,
      });

      // Send using raw email
      return this.sendRawEmail({
        to,
        subject: mailTemplate.subject,
        html: mailTemplate.html,
        text: mailTemplate.text,
      });
    } catch (error) {
      process.stderr.write(
        `${JSON.stringify({ event: 'mail.failed', provider: 'resend', stage: 'template' })}\n`
      );
      return {
        success: false,
        error,
      };
    }
  }

  /**
   * Send a raw email
   * @param params Parameters for sending a raw email
   * @returns Send result
   */
  public async sendRawEmail(
    params: SendRawEmailParams
  ): Promise<SendEmailResult> {
    const { to, subject, html, text } = params;

    if (!this.from || !to || !subject || !html) {
      process.stderr.write(
        `${JSON.stringify({ event: 'mail.failed', provider: 'resend', stage: 'validation' })}\n`
      );
      return {
        success: false,
        error: 'Missing required fields',
      };
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.from,
        to,
        subject,
        html,
        text,
      });

      if (error || !data?.id) {
        process.stderr.write(
          `${JSON.stringify({ event: 'mail.failed', provider: 'resend', code: error?.name || 'missing_message_id' })}\n`
        );
        return {
          success: false,
          error: error || 'Missing provider message ID',
        };
      }

      // Acceptance receipt only; delivery must be verified independently.
      process.stdout.write(
        `${JSON.stringify({ event: 'mail.accepted', provider: 'resend', messageId: data.id })}\n`
      );

      return {
        success: true,
        messageId: data?.id,
      };
    } catch (error) {
      process.stderr.write(
        `${JSON.stringify({ event: 'mail.failed', provider: 'resend', stage: 'transport' })}\n`
      );
      return {
        success: false,
        error,
      };
    }
  }
}
