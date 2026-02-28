# AI Mail Bot

A simple tool to generate and auto-send personalized emails to recruiters using AI.

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set Up the Environment**
   Duplicate `.env.example` into a new file named `.env`:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and configure your credentials:
   - `GEMINI_API_KEY`: Your Google AI Studio API key.
   - `SENDER_EMAIL`: Your Gmail address.
   - `GMAIL_APP_PASSWORD`: Your 16-character [Google App Password](https://myaccount.google.com/apppasswords).

3. **Start the App**
   ```bash
   npm start
   ```
   *This starts both the web interface and the background sender.*

4. **Generate and Send Emails**
   - Head over to `http://localhost:3000` in your browser.
   - **(Optional)** Upload your Resume PDF so the AI can extract your details.
   - Configure your Signature details and daily sending limits.
   - Upload a `.csv` containing: `name,email,company` (Check `example.csv` to see the format).
   - Press **Generate & Enqueue**.
   - Review and edit your drafted emails in the UI.
   - Click **Approve & Start Sending** to send them automatically at their scheduled times!

## How to Get Your Credentials

### 1. Google App Password (for SENDER_EMAIL)
To allow the bot to send emails from your Gmail account, you need an App Password:
1. Go to your [Google Account Security settings](https://myaccount.google.com/security).
2. Ensure **2-Step Verification** is turned on.
3. Search for **App Passwords** in the security search bar.
4. Create a new app password (e.g., name it "AI Mail Bot").
5. Copy the 16-character password generated and paste it into `GMAIL_APP_PASSWORD` in your `.env`.

### 2. Gemini API Key
Currently, this project uses Google's **Gemini** AI. 
**Why Gemini?** Right now, Google offers generous free tiers (equivalent to $300+ in free credits) to access models like Gemini 1.5 Flash, making it incredibly cost-effective for generating hundreds of emails.
1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Sign in and click **Get API Key**.
3. Create a new key and paste it into `GEMINI_API_KEY` in your `.env`.

*Note: In the future, we plan to add support for ChatGPT (OpenAI) and other popular AI models as well. Stay connected!*

## Advanced

- **Skipping Weekends:** The bot automatically schedules emails for Monday-Thursday and obeys the time windows you provide.
- **Dry Run Mode:** Don't want to actually send emails yet? Toggle `DRY_RUN: true` on the web UI to just test the generation process without sending. 
