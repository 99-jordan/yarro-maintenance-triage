import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  type: 'agent_invite' | 'tenant_invite' | 'welcome';
  email: string;
  agencyName?: string;
  inviteUrl?: string;
  propertyAddress?: string;
  agentName?: string;
}

const generateEmailContent = (req: EmailRequest) => {
  const baseUrl = Deno.env.get('VITE_PUBLIC_APP_URL') || 'https://your-app.com';
  
  switch (req.type) {
    case 'agent_invite':
      return {
        subject: `Join ${req.agencyName} as an Agent`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4F46E5;">You're Invited to Join ${req.agencyName}</h2>
            <p>You've been invited to join <strong>${req.agencyName}</strong> as an agent.</p>
            <p>Click the button below to accept your invitation and set up your account:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${req.inviteUrl}" 
                 style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Join Agency
              </a>
            </div>
            <p>Or copy and paste this link in your browser:</p>
            <p style="word-break: break-all; color: #6B7280;">${req.inviteUrl}</p>
            <p style="color: #6B7280; font-size: 14px; margin-top: 30px;">
              This invitation will expire in 7 days. If you didn't expect this invitation, please ignore this email.
            </p>
          </div>
        `,
        text: `
You're invited to join ${req.agencyName} as an agent.

Click this link to accept your invitation: ${req.inviteUrl}

This invitation will expire in 7 days.
        `
      };

    case 'tenant_invite':
      return {
        subject: `Access Your Tenant Portal - ${req.propertyAddress}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4F46E5;">Welcome to Your Tenant Portal</h2>
            <p>You now have access to your tenant portal for:</p>
            <p><strong>${req.propertyAddress}</strong></p>
            <p>Managed by: <strong>${req.agencyName}</strong></p>
            ${req.agentName ? `<p>Your agent: <strong>${req.agentName}</strong></p>` : ''}
            <p>Click the button below to set up your account and access your portal:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${req.inviteUrl}" 
                 style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Access Portal
              </a>
            </div>
            <p>Through your portal you can:</p>
            <ul>
              <li>Report maintenance issues</li>
              <li>Communicate with your agent</li>
              <li>View important property information</li>
              <li>Access documents and updates</li>
            </ul>
            <p>Or copy and paste this link in your browser:</p>
            <p style="word-break: break-all; color: #6B7280;">${req.inviteUrl}</p>
          </div>
        `,
        text: `
Welcome to your tenant portal for ${req.propertyAddress}

Managed by: ${req.agencyName}
${req.agentName ? `Your agent: ${req.agentName}` : ''}

Click this link to access your portal: ${req.inviteUrl}

Through your portal you can report maintenance issues, communicate with your agent, and access important property information.
        `
      };

    case 'welcome':
      return {
        subject: `Welcome to ${req.agencyName}!`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4F46E5;">Welcome to the Platform!</h2>
            <p>Your account has been successfully created.</p>
            <p>You can now access all the features of our property management platform.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${baseUrl}/app" 
                 style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Go to Dashboard
              </a>
            </div>
            <p>If you have any questions, please don't hesitate to reach out to our support team.</p>
          </div>
        `,
        text: `
Welcome to the platform!

Your account has been successfully created. You can now access all the features of our property management platform.

Visit: ${baseUrl}/app

If you have any questions, please don't hesitate to reach out to our support team.
        `
      };

    default:
      throw new Error('Invalid email type');
  }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify the user is authenticated
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const emailRequest: EmailRequest = await req.json();
    
    // In development, just log the email instead of sending
    const isDevelopment = Deno.env.get('ENVIRONMENT') === 'development';
    
    if (isDevelopment) {
      const emailContent = generateEmailContent(emailRequest);
      console.log('=== EMAIL WOULD BE SENT ===');
      console.log('To:', emailRequest.email);
      console.log('Subject:', emailContent.subject);
      console.log('URL:', emailRequest.inviteUrl);
      console.log('========================');
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Email logged in development mode',
          email: emailRequest.email,
          subject: emailContent.subject
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // In production, send actual email using MailerSend or similar service
    const mailerSendApiKey = Deno.env.get('MAILERSEND_API_KEY');
    
    if (!mailerSendApiKey) {
      console.warn('MailerSend API key not configured, skipping email send');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Email service not configured' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const emailContent = generateEmailContent(emailRequest);
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'noreply@youragency.com';
    const fromName = Deno.env.get('FROM_NAME') || 'Your Agency';

    const mailData = {
      from: {
        email: fromEmail,
        name: fromName,
      },
      to: [
        {
          email: emailRequest.email,
        },
      ],
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    };

    const response = await fetch('https://api.mailersend.com/v1/email', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mailerSendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mailData),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('MailerSend error:', errorData);
      throw new Error(`Failed to send email: ${response.status}`);
    }

    const result = await response.json();

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: result.message_id,
        email: emailRequest.email
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in onboarding-mailer:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        success: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
