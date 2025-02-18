const Story = require("../models/Story");
const { uploadFile, deleteFile } = require("../utils/uploadToGcp");
const { Vibrant } = require("node-vibrant/node");

let io;
let cleanupInterval;

// Add cleanup function
const cleanupExpiredStories = async () => {
  try {
    const stories = await Story.find({
      "media.createdAt": {
        $lte: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    });

    for (const story of stories) {
      await story.cleanupExpiredMedia();

      // Remove expired media from the story
      story.media = story.media.filter(
        (m) =>
          new Date(m.createdAt).getTime() + 24 * 60 * 60 * 1000 > Date.now()
      );

      if (story.media.length === 0) {
        await Story.findByIdAndDelete(story._id.toString());
      } else {
        await story.save();
      }
    }
  } catch (error) {
    console.error("Story cleanup error:", error);
  }
};

exports.createStory = async (req, res) => {
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

  try {
    const { image } = req.body;
    const url = await uploadFile({ name: image });
    const [err, color] = await getVibrant(url);

    // Find existing story for user or create new one
    let story = await Story.findOne({ user: req.user._id });

    if (story) {
      // Add new media to existing story
      story.media.push({ url });
    } else {
      // Create new story
      story = await Story.create({
        user: req.user._id,
        media: [{ url }],
        color,
      });
    }

    await story.save();
    await story.populate("user", "username profileImage");

    io.emit("storyUpdated", story);
    res.status(201).json(story);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Modify existing getStories to include cleanup
exports.getStories = async (req, res) => {
  try {
    // Trigger cleanup when stories are fetched
    await cleanupExpiredStories();

    const stories = await Story.find({
      "media.createdAt": {
        $gt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    })
      .populate("user", "username profileImage")
      .sort({ lastUpdated: -1 });

    // Only return stories that have media
    const validStories = stories.filter((story) => story.media.length > 0);

    res.json(validStories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteStory = async (req, res) => {
  try {
    const story = await Story.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!story) {
      return res.status(404).json({ message: "Story not found" });
    }

    io.emit("storyDeleted", story._id);
    res.json({ message: "Story deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add cleanup interval setup to io setter
exports.setIoForStory = (i) => {
  io = i;

  // Clear existing interval if any
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }

  // Run cleanup every hour
  cleanupInterval = setInterval(cleanupExpiredStories, 60 * 60 * 1000);
};
