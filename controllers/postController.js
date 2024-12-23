const Post = require("../models/Post");
const { uploadFile, deleteFile } = require("../utils/uploadToGcp");

let io;

exports.createPost = async (req, res) => {
  try {
    const { content, media } = req.body;

    const fileName = media[0]?.url.split("/").pop();
    const url = await uploadFile({ name: fileName });
    const post = await Post.create({
      user: req.user._id,
      content,
      image: url,
    });

    await post.populate("user", "username profileImage");
    io.emit("newPost", post);
    res.status(201).json(post);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.getPosts = async (req, res) => {
  try {
    const posts = await Post.find()
      .populate("user", "username profileImage")
      .sort({ createdAt: -1 });
    //populate('comments.user', 'username profileImage')
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.getPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate(
      "user",
      "username profileImage"
    );

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    res.json(post);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (post.image) {
      const file = post.image.split("/").pop();
      await deleteFile(file);
    }
    await Post.findByIdAndDelete(post._id.toString());

    if (io) {
      io.emit("postDeleted", post._id.toString());
    }

    res.json({ message: "Post deleted" });
  } catch (error) {
    res.status(500).json({ message: `Server error: ${error.message}` });
  }
};

exports.likePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (post.likes.includes(req.user._id)) {
      return res.status(400).json({ message: "Post already liked" });
    }

    post.likes.push(req.user._id);
    await post.save();

    res.json(post);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.unlikePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (!post.likes.includes(req.user._id)) {
      return res.status(400).json({ message: "Post not liked" });
    }

    post.likes = post.likes.filter(
      (like) => like.toString() !== req.user._id.toString()
    );
    await post.save();
    res.json(post);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.addComment = async (req, res) => {
  try {
    const { content } = req.body;

    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const comment = {
      user: req.user._id,
      content,
    };

    post.comments.push(comment);
    await post.save();

    res.json(post);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const comment = post.comments.find(
      (comment) => comment._id.toString() === req.params.commentId
    );

    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    if (comment.user.toString() !== req.user._id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    post.comments = post.comments.filter(
      (comment) => comment._id.toString() !== req.params.commentId
    );
    await post.save();

    res.json(post);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.addReply = async (req, res) => {
  try {
    const { content } = req.body;
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const comment = post.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    comment.replies.push({
      user: req.user._id,
      content,
    });

    await post.save();

    res.json(post);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.setIoForPost = (i) => {
  io = i;
};
