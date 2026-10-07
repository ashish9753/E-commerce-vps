import Note from "../models/note.model.js";
import ApiResponse from "../utils/ApiResponse.js";

export const listNotes = async (_req, res, next) => {
  try {
    const notes = await Note.find().sort({ updatedAt: -1 }).lean();
    res.json(new ApiResponse(200, { notes }));
  } catch (err) { next(err); }
};

export const createNote = async (req, res, next) => {
  try {
    const title = String(req.body.title || "").trim();
    const content = String(req.body.content || "").trim();
    if (!title || !content) return res.status(400).json(new ApiResponse(400, null, "Title and note are required"));
    if (title.length > 120 || content.length > 10000) {
      return res.status(400).json(new ApiResponse(400, null, "Title must be 120 characters or less and note must be 10,000 characters or less"));
    }
    const note = await Note.create({ title, content });
    res.status(201).json(new ApiResponse(201, { note }, "Note saved"));
  } catch (err) { next(err); }
};

export const deleteNote = async (req, res, next) => {
  try {
    const note = await Note.findByIdAndDelete(req.params.noteId);
    if (!note) return res.status(404).json(new ApiResponse(404, null, "Note not found"));
    res.json(new ApiResponse(200, null, "Note deleted"));
  } catch (err) { next(err); }
};
