'use server';

import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { isEmailOutboundEnabled } from '@/lib/email-feature';

interface MailAttachment {
    filename: string;
    content: string; // Must be base64 encoded string
    contentType: string;
}

interface MailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: MailAttachment[];
}

/**
 * Queues an email by writing to the `mail` collection (e.g. for Trigger Email).
 * Disabled unless NEXT_PUBLIC_EMAIL_OUTBOUND_ENABLED=true.
 */
export async function sendEmail(options: MailOptions) {
  if (!isEmailOutboundEnabled()) {
    return;
  }

  try {
    const mailCollection = collection(db, 'mail');
    
    // The document structure must match what the Trigger Email extension expects.
    const emailDocument = {
      to: [options.to],
      message: {
        subject: options.subject,
        html: options.html,
        attachments: options.attachments?.map(att => ({
            filename: att.filename,
            content: att.content,
            encoding: 'base64',
            contentType: att.contentType,
        })),
      },
    };

    await addDoc(mailCollection, emailDocument);
    console.log('Email document successfully added to Firestore for processing.');

  } catch (error) {
    console.error('Error adding email document to Firestore:', error);
    if (error instanceof Error) {
        throw new Error(`Failed to queue email: ${error.message}`);
    }
    throw new Error('Failed to queue email due to an unknown error.');
  }
}
