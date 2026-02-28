import { config } from './config';

const parseTime = (timeStr: string) => {
    if (!timeStr) return { h: 9, m: 0 };
    const parts = timeStr.split(':').map(Number);
    return { h: parts[0] || 0, m: parts[1] || 0 };
};

const isAllowedDay = (date: Date) => {
    const day = date.getDay();
    // 1=Mon, 2=Tue, 3=Wed, 4=Thu
    return day >= 1 && day <= 4;
};

const getNextAllowedDay = (date: Date) => {
    const d = new Date(date);
    while (!isAllowedDay(d)) {
        d.setDate(d.getDate() + 1);
    }
    return d;
};

export const scheduleEmails = (totalCount: number, overrides?: {
    START_DATE?: string;
    SEND_WINDOW_START?: string;
    SEND_WINDOW_END?: string;
    DAILY_LIMIT?: number;
}): number[] => {
    const START_DATE = overrides?.START_DATE || config.START_DATE;
    const SEND_WINDOW_START = overrides?.SEND_WINDOW_START || config.SEND_WINDOW_START;
    const SEND_WINDOW_END = overrides?.SEND_WINDOW_END || config.SEND_WINDOW_END;
    const DAILY_LIMIT = overrides?.DAILY_LIMIT || config.DAILY_LIMIT;

    let currentDate = new Date(START_DATE as string);
    currentDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (currentDate.getTime() < today.getTime()) {
        currentDate = new Date(today);
    }

    currentDate = getNextAllowedDay(currentDate);

    const startT = parseTime(SEND_WINDOW_START as string);
    const endT = parseTime(SEND_WINDOW_END as string);

    const startMins = startT.h * 60 + startT.m;
    const endMins = endT.h * 60 + endT.m;
    const windowDurationMins = endMins - startMins;

    const intervalMins = windowDurationMins / (DAILY_LIMIT as number);

    const schedule: number[] = [];
    let currentDayEmailsCount = 0;

    for (let i = 0; i < totalCount; i++) {
        if (currentDayEmailsCount >= (DAILY_LIMIT as number)) {
            currentDate.setDate(currentDate.getDate() + 1);
            currentDate = getNextAllowedDay(currentDate);
            currentDayEmailsCount = 0;
        }

        const scheduledDate = new Date(currentDate);
        const offsetMins = startMins + (intervalMins * currentDayEmailsCount);

        scheduledDate.setHours(Math.floor(offsetMins / 60));
        scheduledDate.setMinutes(Math.floor(offsetMins % 60));
        scheduledDate.setSeconds(0);
        scheduledDate.setMilliseconds(0);

        schedule.push(scheduledDate.getTime());
        currentDayEmailsCount++;
    }

    return schedule;
};
