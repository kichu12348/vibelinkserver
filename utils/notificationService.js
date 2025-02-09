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
            // Add expiration
            ttl: 3600, // expires in 1 hour
            badge: 1,
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
            // Add expiration
            ttl: 3600, // expires in 1 hour
            badge: 1,
        }));

        const chunks = expo.chunkPushNotifications(messages);
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
        console.error('Error sending announcement:', error);
    }
}

async function deleteNotification(tickets) {
    try {
        if (!Array.isArray(tickets) || tickets.length === 0) {
            return;
        }

        // After sending notifications, check receipts
        const receiptIds = tickets.map(ticket => ticket.id);
        const receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
        
        for (let chunk of receiptIdChunks) {
            try {
                const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
                
                // Process each receipt
                for (const [receiptId, receipt] of Object.entries(receipts)) {
                    if (receipt.status === 'error') {
                        console.log(`Error with notification ${receiptId}:`, receipt.message);
                        
                        // If the error is due to an invalid token, remove it from the user
                        if (receipt.details && receipt.details.error === 'DeviceNotRegistered') {
                            await User.updateOne(
                                { expoPushToken: receipt.details.expoPushToken },
                                { $unset: { expoPushToken: 1 } }
                            );
                        }
                    }

                    
                }
            } catch (error) {
                console.log('Error checking receipts:', error.message);
            }
        }
    } catch (error) {
        console.log('Error in deleteNotification:', error.message);
    }
}

// Note: For complete notification management
// clearNotifications() on the client side using:
// Notifications.dismissAllNotificationsAsync()

module.exports = {
    sendPushNotification,
    sendAnnouncementToAll,
    deleteNotification,
};
