import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, subject, html, text } = await req.json() as EmailRequest;
    
    const mailerSendApiKey = Deno.env.get('MAILERSEND_API_KEY');
    const fromEmail = Deno.env.get('MAILERSEND_FROM_EMAIL') || 'jordanyussuf@gmail.com';
    const fromName = Deno.env.get('MAILERSEND_FROM_NAME') || 'Jordan Yussuf';

    if (!mailerSendApiKey) {
      throw new Error('MailerSend API key not configured');
    }

    // According to MailerSend API documentation
    const requestBody = {
      from: {
        email: fromEmail,
        name: fromName
      },
      to: [
        {
          email: to
        }
      ],
      subject,
      html,
      text: text || stripHtml(html)
    };

    console.log('Sending email via MailerSend:', {
      to,
      subject,
      fromEmail,
      fromName
    });

    const response = await fetch('https://api.mailersend.com/v1/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mailerSendApiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('MailerSend API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      throw new Error(errorData.message || `MailerSend API returned ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('MailerSend API success:', result);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: result.message_id,
        recipientCount: 1
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Email sending error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        recipientCount: 0
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
} 