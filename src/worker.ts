import { readQueue, updateQueueItem } from './queue';
import { sendMail } from './mailer';

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

const randomDelay = () => {
    // 30 to 50 seconds
    const min = 30000;
    const max = 50000;
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

const processQueue = async () => {
    console.log('\n========================================');
    console.log('Worker started. Actively checking queue.json...');
    console.log('========================================\n');

    while (true) {
        const queue = readQueue();
        const now = Date.now();

        // Find items that are queued and their sendAt time has passed
        const pendingItems = queue.filter(
            (q) => q.status === 'queued' && q.sendAt <= now
        );

        if (pendingItems.length > 0) {
            console.log(`Found ${pendingItems.length} pending emails ready to send. Processing...`);

            for (const item of pendingItems) {
                try {
                    console.log(`[Worker] Attempting to send email to ${item.email}...`);
                    await sendMail(item.email, item.subject, item.htmlBody);

                    updateQueueItem(item.id, {
                        status: 'sent',
                        sentAt: Date.now(),
                    });
                    console.log(`[Worker] Successfully sent email to ${item.email}.`);

                } catch (error: any) {
                    console.error(`[Worker] Failed to send email to ${item.email}:`, error.message);

                    const newRetries = item.retries + 1;
                    const status = newRetries >= 2 ? 'error' : 'queued';

                    updateQueueItem(item.id, {
                        status,
                        retries: newRetries,
                    });
                    console.log(`[Worker] Updated status to '${status}' after ${newRetries} retries.`);
                }

                // Wait between 30 and 50 seconds before sending the next email
                const ms = randomDelay();
                console.log(`[Worker] Jitter: Waiting ${Math.floor(ms / 1000)} seconds before next action to avoid rate limits...\n`);
                await delay(ms);
            }
        } else {
            // Polling delay if no tasks currently
            const nextItem = queue
                .filter((q) => q.status === 'queued')
                .sort((a, b) => a.sendAt - b.sendAt)[0];

            if (nextItem) {
                console.log(`[Worker] Idle. Next scheduled email: ${nextItem.email} at ${new Date(nextItem.sendAt).toLocaleString()}`);
            } else {
                console.log("[Worker] Idle. No emails in queue.");
            }
            await delay(30000); // check every 30 seconds when idle
        }
    }
};

export const startWorker = () => {
    processQueue().catch((err) => {
        console.error("Critical worker error:", err);
    });
};

if (require.main === module) {
    startWorker();
}
