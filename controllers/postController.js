const Post = require("../models/Post");
const { uploadFile, deleteFile } = require("../utils/uploadToGcp");
const { sendPushNotification } = require("../utils/notificationService");
const { Vibrant } = require("node-vibrant/node");

let io;

exports.createPost = async (req, res) => {
  try {
    const { content, media } = req.body;


    const checkIfCloseToWhite = (rgb) => {
      const [r, g, b] = rgb;
      const test = r > 200 && g > 200 && b > 200;
      if (!test) return [test, null];
      const offset = 0.5;
      const newRGB = `rgb(${r*offset}, ${g *offset}, ${b * offset})`;
      return [test, newRGB];
    }


    const getVibrant = async (url) => {
      try {
        const v = new Vibrant(url);
        const palette = await v.getPalette();
        const Arr = palette.LightVibrant.rgb;
        const rgb = `rgb(${Arr[0]}, ${Arr[1]}, ${Arr[2]})`;
        const [isCloseToWhite, newRGB] = checkIfCloseToWhite(Arr);
        if (isCloseToWhite) {
          return [null, newRGB];
        }
        return [null, rgb];
      } catch (error) {
        return [error.message, "#23252F"];
      }
    };

    if(!media[0]?.url){
      const post = await Post.create({
        user: req.user._id,
        content,
      });
      await post.populate("user", "username profileImage");
      io.emit("newPost", post);
      return res.status(201).json(post);
    };

    const fileName = media[0]?.url.split("/").pop();
    const url = await uploadFile({ name: fileName });
    const [err,color] = await getVibrant(url);
    const post = await Post.create({
      user: req.user._id,
      content,
      image: url,
      color: color,
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
      .sort({ createdAt: -1 })
      .populate("comments.user", "username profileImage")
      .populate("comments.replies.user", "username profileImage")
      .populate("likes", "username profileImage");


    let allPosts = [];

    const getVibrant = async (url) => {
      try {
        const v = new Vibrant(url);
        const palette = await v.getPalette();
        const Arr = palette.LightVibrant.rgb;
        const rgb = `rgb(${Arr[0]}, ${Arr[1]}, ${Arr[2]})`;
        return [null, rgb];
      } catch (error) {
        return [error.message, "#23252F"];
      }
    };

    for (const post of posts) {
      if(post.image && post.color==="#23252F"){
        const [err,color] = await getVibrant(post.image);
        await Post.findByIdAndUpdate(post._id, {color: color});
        post.color = color;
        allPosts.push(post);
      }
      else{
        allPosts.push(post);
      }
    };
    res.json(allPosts);
  } catch (error) {
    res.status(500).json({ message: `Server error: ${error.message}` });
  }
};

exports.getPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate("user", "username profileImage")
      .populate("comments.user", "username profileImage")
      .populate("comments.replies.user", "username profileImage")
      .populate("likes", "username profileImage");

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
    const post = await Post.findById(req.params.id)
      .populate("user", "username profileImage")
      .populate("comments.user", "username profileImage")
      .populate("comments.replies.user", "username profileImage");

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (post.likes.includes(req.user._id)) {
      return res.status(400).json({ message: "Post already liked" });
    }

    post.likes.push(req.user._id);
    await post.save();

    // Emit notification to post owner
    if (post.user._id.toString() !== req.user._id.toString()) {
      io.to(post.user._id.toString()).emit("postLiked", {
        postId: post._id,
        likedBy: {
          _id: req.user._id,
          username: req.user.username,
          profileImage: req.user.profileImage,
        },
        post: {
          _id: post._id,
          content:
            post.content.substring(0, 50) +
            (post.content.length > 50 ? "..." : ""),
        },
      });

      await sendPushNotification(
        post.user._id.toString(),
        "New Like",
        `${req.user.username} liked your post`,
        { PostId: post._id }
      );
    }

    

    await post.populate("likes", "username profileImage");

    // Emit real-time update to all clients
    io.emit("postUpdated", post);

    res.json(post);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.unlikePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate("user", "username profileImage")
      .populate("comments.user", "username profileImage")
      .populate("comments.replies.user", "username profileImage");

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

    await post.populate("likes", "username profileImage");

    io.emit("postUpdated", post);

    res.json(post);
  } catch (error) {
    res.status(500).json({ message: `Server Error: ${error.message}` });
  }
};

exports.addComment = async (req, res) => {
  try {
    const { content } = req.body;

    const post = await Post.findById(req.params.id)
      .populate("user", "username profileImage");

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const comment = {
      user: req.user._id,
      content,
    };

    post.comments.push(comment);
    await post.save();

    if (post.user._id.toString() !== req.user._id.toString()) {
      await sendPushNotification(
        post.user._id.toString(),
        "New Comment",
        `${req.user.username} commented ${content} on your post`,
        { PostId: post._id.toString() }
      );
    }

    const newPost = await Post.findById(req.params.id)
    .populate("user", "username profileImage")
    .populate("likes", "username profileImage")
    .populate("comments.user", "username profileImage")
    .populate("comments.replies.user", "username profileImage");

    io.emit("postUpdated", newPost);

    res.json(newPost);
  } catch (error) {
    res.status(500).json({ message: `Server Error :${error.message}` });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate("user", "username profileImage")
      .populate("likes", "username profileImage")
      .populate("comments.user", "username profileImage")
      .populate("comments.replies.user", "username profileImage");

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
    io.emit("postUpdated", post);

    res.json(post);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.addReply = async (req, res) => {
  try {
    const { content } = req.body;
    const post = await Post.findById(req.params.id)
      .populate("user", "username profileImage");
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

    const commentUser = () => {
      if (typeof comment.user === "string") return comment.user;
      return comment.user._id.toString();
    };

    if (commentUser() !== req.user._id.toString()) {
      await sendPushNotification(
        commentUser(),
        "New Reply",
        `${req.user.username} replied ${content} on your comment`,
        { PostId: post._id.toString() }
      );
    }

    const newPost = await Post.findById(req.params.id)
    .populate("user", "username profileImage")
    .populate("likes", "username profileImage")
    .populate("comments.user", "username profileImage")
    .populate("comments.replies.user", "username profileImage");

    io.emit("postUpdated", newPost);

    res.json(newPost);
  } catch (error) {
    res.status(500).json({ message: `Server Error: ${error.message}` });
  }
};


exports.getVibrantColor = async (req, res) => {
  const getVibrant = async (url) => {
    try {
      const v = new Vibrant(url);
      const palette = await v.getPalette();
      const Arr = palette.LightVibrant.rgb;
      const rgb = `rgb(${Arr[0]}, ${Arr[1]}, ${Arr[2]})`;
      return [null, rgb];
    } catch (error) {
      return [error.message, null];
    }
  };

  const [error, rgb] = await getVibrant(req.body.url);
  if (error) {
    return res.status(500).json({ message: error });
  }

  res.json({ rgb });
};

exports.setIoForPost = (i) => {
  io = i;
};
