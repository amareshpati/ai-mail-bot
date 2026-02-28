import fs from 'fs';
import path from 'path';
import { config } from './config';

export type QueueStatus = 'draft' | 'queued' | 'sent' | 'error' | 'dry-run';

export interface QueueItem {
    id: string;
    name: string;
    email: string;
    company?: string;
    subject: string;
    htmlBody: string;
    sendAt: number; // epoch ms
    status: QueueStatus;
    retries: number;
    createdAt: number;
    sentAt?: number;
}

const getQueuePath = () => path.resolve(process.cwd(), config.QUEUE_FILE);

export const readQueue = (): QueueItem[] => {
    const p = getQueuePath();
    if (!fs.existsSync(p)) return [];
    try {
        const data = fs.readFileSync(p, 'utf-8');
        return JSON.parse(data) as QueueItem[];
    } catch (error) {
        console.error('Error reading queue:', error);
        return [];
    }
};

export const writeQueue = (queue: QueueItem[]): void => {
    try {
        const p = getQueuePath();
        fs.writeFileSync(p, JSON.stringify(queue, null, 2), 'utf-8');
    } catch (error) {
        console.error('Error writing queue:', error);
    }
};

export const updateQueueItem = (id: string, updates: Partial<QueueItem>): void => {
    const queue = readQueue();
    const index = queue.findIndex((q) => q.id === id);
    if (index !== -1) {
        queue[index] = { ...queue[index], ...updates };
        writeQueue(queue);
    }
};

export const approveQueueDrafts = (): number => {
    const queue = readQueue();
    let count = 0;
    for (const item of queue) {
        if (item.status === 'draft') {
            item.status = 'queued';
            count++;
        }
    }
    if (count > 0) writeQueue(queue);
    return count;
};
