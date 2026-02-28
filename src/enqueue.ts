import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import csvParser from 'csv-parser';
import crypto from 'crypto';
import os from 'os';

import { config } from './config';
import { generateEmail, extractSignatureDetails, clearResumeCache, generateSuggestedPrompt } from './gemini';
const pdf = require('pdf-parse');
import { scheduleEmails } from './scheduler';
import { readQueue, writeQueue, QueueItem, approveQueueDrafts } from './queue';
import { startWorker } from './worker';

const app = express();
const upload = multer({ dest: os.tmpdir() });

app.use(express.static(path.join(process.cwd(), 'public')));

app.get('/api/config', (req, res) => {
    res.json(config);
});

app.post('/api/extract-resume', upload.single('resume'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No resume file uploaded' });
    }

    try {
        const resumeDir = path.join(process.cwd(), 'resume');
        if (!fs.existsSync(resumeDir)) {
            fs.mkdirSync(resumeDir, { recursive: true });
        }
        const newResumePath = path.join(resumeDir, 'resume.pdf');
        fs.copyFileSync(req.file.path, newResumePath);

        const dataBuffer = fs.readFileSync(newResumePath);
        const data = await pdf(dataBuffer);
        const text = data.text || '';

        const apiKey = req.body.apiKey || undefined;
        clearResumeCache();

        const details = await extractSignatureDetails(text, apiKey);
        const suggestedPrompt = await generateSuggestedPrompt(text, apiKey);

        fs.unlinkSync(req.file.path);
        res.json({ ...details, suggestedPrompt });
    } catch (error: any) {
        console.error('Extraction error:', error);
        res.status(500).json({ error: error.message || 'Failed to extract resume details' });
    }
});

app.post('/api/enqueue', upload.single('csvFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const results: any[] = [];
    try {
        // 1. Parse CSV
        await new Promise((resolve, reject) => {
            fs.createReadStream(req.file!.path)
                .pipe(csvParser())
                .on('data', (data) => results.push(data))
                .on('end', resolve)
                .on('error', reject);
        });

        if (results.length === 0) {
            return res.status(400).json({ error: 'CSV file is empty' });
        }

        const overrides = {
            START_DATE: req.body.START_DATE || undefined,
            SEND_WINDOW_START: req.body.SEND_WINDOW_START || undefined,
            SEND_WINDOW_END: req.body.SEND_WINDOW_END || undefined,
            DAILY_LIMIT: req.body.DAILY_LIMIT ? parseInt(req.body.DAILY_LIMIT, 2) : undefined
        };
        const apiKey = req.body.GEMINI_API_KEY || undefined;

        const queue = readQueue();
        const timestamps = scheduleEmails(results.length, overrides);
        let successCount = 0;
        const generatedEmails: QueueItem[] = [];
        // 2. Process rows sequentially
        for (let i = 0; i < results.length; i++) {
            const row = results[i];
            const email = row.email?.trim();
            const name = row.name?.trim();
            const company = row.company?.trim();
            console.log(`Processing row ${i + 1} of ${results.length}:`, row);
            if (!email) {
                console.warn('Skipping row without email:', row);
                continue;
            }

            console.log(`Generating email for ${email}...`);
            try {
                const promptTemplate = req.body.promptTemplate || '';
                const signatureData = {
                    name: req.body.sigName || '',
                    role: req.body.sigRole || '',
                    phone: req.body.sigPhone || '',
                    portfolio: req.body.sigPortfolio || '',
                    linkedin: req.body.sigLinkedin || '',
                    github: req.body.sigGithub || ''
                };

                const { subject, htmlBody } = await generateEmail(email, name, company, promptTemplate, signatureData, apiKey);

                const item: QueueItem = {
                    id: crypto.randomUUID(),
                    name: name || '',
                    email: email,
                    company: company,
                    subject,
                    htmlBody,
                    sendAt: timestamps[i] as number,
                    status: 'draft',
                    retries: 0,
                    createdAt: Date.now(),
                };

                queue.push(item);
                generatedEmails.push(item);
                successCount++;

                // Add a tiny delay to not overwhelm Gemini API limits
                await new Promise(r => setTimeout(r, 1000));

            } catch (genErr) {
                console.error(`Failed to generate email for ${email}:`, genErr);
            }
        }

        // 3. Write Queue
        writeQueue(queue);

        // Clean up temp file
        fs.unlinkSync(req.file.path);

        res.json({ success: true, enqueued: successCount, generatedEmails });
        console.log(`Successfully enqueued ${successCount} emails.`);
    } catch (error: any) {
        console.error('Enqueue error:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

app.put('/api/edit-draft/:id', express.json(), (req, res) => {
    try {
        const { id } = req.params;
        const { subject, htmlBody } = req.body;

        const queue = readQueue();
        const index = queue.findIndex(q => q.id === id);

        if (index === -1) {
            return res.status(404).json({ error: 'Draft not found' });
        }

        if (queue[index].status !== 'draft') {
            return res.status(400).json({ error: 'Can only edit emails in draft status' });
        }

        queue[index].subject = subject !== undefined ? subject : queue[index].subject;
        queue[index].htmlBody = htmlBody !== undefined ? htmlBody : queue[index].htmlBody;

        writeQueue(queue);
        res.json({ success: true, updatedItem: queue[index] });
    } catch (error: any) {
        console.error('Edit draft error:', error);
        res.status(500).json({ error: 'Failed to update draft email' });
    }
});

app.post('/api/approve', (req, res) => {
    try {
        const approvedCount = approveQueueDrafts();
        res.json({ success: true, approved: approvedCount });
        console.log(`\n========================================`);
        console.log(`User approved ${approvedCount} draft emails. Worker will now process them.`);
        console.log(`========================================\n`);
    } catch (error: any) {
        console.error('Approval error:', error);
        res.status(500).json({ error: 'Failed to approve drafts' });
    }
});

app.listen(config.PORT, () => {
    console.log(`\n========================================`);
    console.log(`Frontend is running at http://localhost:${config.PORT}`);
    console.log(`Upload your CSV there to generate and enqueue emails.`);
    console.log(`========================================\n`);

    // Start background worker unified in the same process
    startWorker();
});
