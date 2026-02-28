import nodemailer from 'nodemailer';
import path from 'path';
import fs from 'fs';
import { config } from './config';

export const sendMail = async (to: string, subject: string, html: string) => {
    if (config.DRY_RUN) {
        console.log(`\n[DRY RUN] Would send email to ${to}\nSubject: ${subject}`);
        return;
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: config.SENDER_EMAIL,
            pass: config.GMAIL_APP_PASSWORD,
        },
    });

    const resumePath = path.resolve(process.cwd(), 'resume', 'resume.pdf');
    const attachments = [];
    if (fs.existsSync(resumePath)) {
        attachments.push({
            filename: 'resume.pdf',
            path: resumePath,
        });
    } else {
        console.warn('WARNING: resume/resume.pdf not found. Sending without attachment.');
    }

    const mailOptions = {
        from: config.SENDER_EMAIL,
        to,
        subject,
        html,
        attachments,
    };

    await transporter.sendMail(mailOptions);
};
