import { Router } from "express";
import { createNote, deleteNote, listNotes } from "../controllers/note.controller.js";

const router = Router();
router.get("/", listNotes);
router.post("/", createNote);
router.delete("/:noteId", deleteNote);

export default router;
