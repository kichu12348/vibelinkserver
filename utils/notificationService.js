const { Expo } = require('expo-server-sdk');
const User = require('../models/User');

const expo = new Expo();

async function sendPushNotification(userId, title, body, data = {}) {
    try {
        const user = await User.findById(userId);
        if (!user?.expoPushToken) return;

        const message = {
            to: user.expoPushToken,
            sound: 'default',
            title,
            body,
            data,
            priority: 'high',
        };

        if (!Expo.isExpoPushToken(message.to)) {
            console.log(`Invalid Expo push token: ${message.to}`);
            return;
        }

        const chunks = expo.chunkPushNotifications([message]);
        const tickets = [];

        for (let chunk of chunks) {
            try {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
            } catch (error) {
                console.log('Error sending chunk:', error.message);
            }
        }

        return tickets;
    } catch (error) {
        console.error('Error sending push notification:', error);
    }
}

let tickets = [];

async function sendAnnouncementToAll(title, body, data = {}) {
    try {
        const users = await User.find({ expoPushToken: { $ne: null } });
        const messages = users.map((user) => ({
            to: user.expoPushToken,
            sound: 'default',
            title,
            body,
            data,
            priority: 'high',
        }));

        const chunks = expo.chunkPushNotifications(messages);
        for (let chunk of chunks) {
            try {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
            } catch (error) {
                console.log('Error sending chunk:', error.message);
            }
        }
        return tickets;
    } catch (error) {
        console.error('Error sending announcement:', error);
    }
}


async function deleteNotification(tickets) {
    try {
        const receiptIds = tickets.map((ticket) => ticket.id);
        const receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
        for (let chunk of receiptIdChunks) {
            try {
                const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
                for (let receiptId in receipts) {
                    const { status } = receipts[receiptId];
                    if (status === 'error') {
                        const { message } = receipts[receiptId];
                        console.error(`There was an error sending a notification: ${message}`);
                    }
                }
            } catch (error) {
                console.error('Error deleting notification:', error);
            }
        }
    } catch (error) {
        console.error('Error deleting notification:', error);
    }
};

module.exports = {
    sendPushNotification,
    sendAnnouncementToAll
};
