const Users = require('../models/User');
const Posts = require('../models/Post');
const Messages = require('../models/Message');



async function getNumberOfAll(){
    const users = await Users.countDocuments();
    const posts = await Posts.countDocuments();
    const messages = await Messages.countDocuments();
    return {users, posts, messages};
}

module.exports = {getNumberOfAll};