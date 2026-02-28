import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from './config';
import fs from 'fs';
import path from 'path';
const pdf = require('pdf-parse');

let resumeTextCache: string | null = null;

export const clearResumeCache = () => {
    resumeTextCache = null;
};

async function getResumeText(): Promise<string> {
    if (resumeTextCache !== null) return resumeTextCache;
    const resumePath = path.join(process.cwd(), 'resume', 'resume.pdf');
    if (fs.existsSync(resumePath)) {
        try {
            const dataBuffer = fs.readFileSync(resumePath);
            const data = await pdf(dataBuffer);
            resumeTextCache = data.text || '';
            return resumeTextCache as string;
        } catch (error) {
            console.error("Error parsing resume PDF:", error);
            return '';
        }
    }
    return '';
}

export interface SignatureData {
    name: string;
    role: string;
    phone: string;
    portfolio: string;
    linkedin: string;
    github: string;
}

export const extractSignatureDetails = async (resumeText: string, apiKeyOverride?: string): Promise<SignatureData> => {
    const apiKey = apiKeyOverride || config.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is missing');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    const prompt = `Extract the following contact details strictly from the resume below.
Return the output strictly in JSON format with exactly these keys: "name", "role", "phone", "portfolio", "linkedin", "github".
If a value is not found, use an empty string. Make "role" a concise professional title (e.g. "Software Engineer").
RESUME CONTENT:
---
${resumeText}
---
Ensure no markdown formatting or extra text, just raw JSON string.`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    try {
        const rawJson = response.replace(/^```[a-z]*\s*/, '').replace(/```\s*$/, '').trim();
        return JSON.parse(rawJson) as SignatureData;
    } catch (e) {
        console.error("Failed to parse extracted signature details:", response);
        throw new Error('Failed to extract signature details.');
    }
};

export const generateSuggestedPrompt = async (resumeText: string, apiKeyOverride?: string): Promise<string> => {
    const apiKey = apiKeyOverride || config.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is missing');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    const prompt = `Analyze the following resume and write a highly effective SYSTEM PROMPT TEMPLATE.
This template will be used to instruct an AI to write personalized cold emails to recruiters on behalf of this candidate.

CRITICAL INSTRUCTIONS FOR THE TEMPLATE YOU GENERATE:
1. It MUST include the following literal variables EXACTLY as written: {{inferredName}}, {{inferredCompany}}, and {{resumeText}}.
2. It MUST explicitly instruct the AI to use exactly "Hi {{inferredName}}," or "Dear {{inferredName}}," as the greeting. Tell the AI it is FORBIDDEN to use placeholders like [Name] or [Hiring Manager].
3. It MUST explicitly instruct the AI to reference {{inferredCompany}} in the body of the email.
4. It MUST define the persona (e.g., "You are a [Job Title] with expertise in [Skills]") and provide email guidelines (under 150 words, compelling CTA, professional tone).
5. It MUST instruct the AI to NOT include any sign-off, closing, or signature (like "Best regards", "Sincerely", or the candidate's name) as a custom signature will be appended automatically.
6. It MUST end with instructions to return the output STRICTLY in JSON format with "subject" and "htmlBody" string keys.
7. Do not include any greeting, preamble, or markdown formatting in your response. Output ONLY the raw prompt template text.

RESUME:
---
${resumeText}
---
`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
};

export const generateEmail = async (
    email: string,
    name?: string,
    company?: string,
    promptTemplate?: string,
    signatureData?: SignatureData,
    apiKeyOverride?: string
): Promise<{ subject: string; htmlBody: string }> => {
    const apiKey = apiKeyOverride || config.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is missing');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const inferredName = name || email.split('@')[0].split(/[._+-]/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
    const inferredCompany = company || email.split('@')[1]?.split('.')[0].toUpperCase() || 'your company';

    const resumeText = await getResumeText();

    let prompt = promptTemplate || `You are a professional software engineer reaching out to a recruiter.
I have provided my resume content below to help you personalize the email.
RESUME CONTENT:
---
{{resumeText}}
---

Create a highly personalized, professional, and concise email (under 150 words) for a recruiter.
CRITICAL INSTRUCTIONS:
1. You MUST start the email with exactly "Hi {{inferredName}}," or "Dear {{inferredName}}," and NEVER use placeholders like [Name] or [Hiring Manager].
2. You MUST explicitly reference {{inferredCompany}} in the body of the email.
3. Use specific details from my resume (skills, projects, or experience) that would be relevant to {{inferredCompany}} to make the email stand out.
4. DO NOT include any sign-off, closing, or signature (like "Best regards", "Sincerely", or your name) at the end of the email. A custom HTML signature will be automatically appended.

Return the output strictly in JSON format as follows:
{
  "subject": "Compelling subject line",
  "htmlBody": "<p>Hi {{inferredName}},</p><p>...rest of the email HTML...</p>"
}
No markdown formatting for the json, just raw JSON string.`;

    // Inject dynamic variables into the prompt
    prompt = prompt.replace(/\{\{inferredName\}\}/g, inferredName);
    prompt = prompt.replace(/\{\{inferredCompany\}\}/g, inferredCompany);
    prompt = prompt.replace(/\{\{resumeText\}\}/g, resumeText);

    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
    const result = await model.generateContent(prompt);
    const response = result.response.text();

    try {
        const rawJson = response.replace(/^```[a-z]*\s*/, '').replace(/```\s*$/, '').trim();
        const parsed = JSON.parse(rawJson);

        let htmlBody = parsed.htmlBody;
        // Strip out generated sign-offs in case the AI hallucinates them despite instructions
        htmlBody = htmlBody.replace(/(?:<br\s*\/?>|<\/?p>|\s)*(?:Best regards|Sincerely|Warm regards|Regards)[\s\S]*$/i, '');

        let signature = '';
        if (signatureData && (signatureData.name || signatureData.role)) {
            signature = `
<br><br>
<hr style="border: none; border-top: 1px solid #ccc; margin: 20px 0;">
<div style="font-family: Arial, sans-serif; line-height: 1.5;">
  <strong>${signatureData.name}</strong><br>
  ${signatureData.role}<br><br>
  ${signatureData.phone ? `📲 ${signatureData.phone}<br>` : ''}
  ${signatureData.portfolio ? `🌐 <a href="${signatureData.portfolio}">Portfolio</a> | ` : ''}
  ${signatureData.linkedin ? `🔗 <a href="${signatureData.linkedin}">LinkedIn</a> | ` : ''}
  ${signatureData.github ? `🧑🏻‍💻 <a href="${signatureData.github}">GitHub</a>` : ''}
</div>
`;
        }

        return {
            subject: parsed.subject,
            htmlBody: htmlBody + signature,
        };
    } catch (error) {
        console.error("Failed to parse Gemini response:", response);
        throw new Error('Failed to generate personalized email.');
    }
};
