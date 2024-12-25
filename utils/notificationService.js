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

module.exports = { sendPushNotification };
