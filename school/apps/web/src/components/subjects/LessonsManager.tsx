"use client";

import { useState } from "react";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import { GripVertical, Plus, Trash2, X } from "lucide-react";
import { apiClient } from "@/lib/api";
import type { Lesson } from "./SubjectsManager";

export function LessonsManager({
  stageId,
  initialLessons,
  onUpdate,
}: {
  stageId: string;
  initialLessons: Lesson[];
  onUpdate: () => void;
}) {
  const [lessons, setLessons] = useState(initialLessons);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(lessons);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    const nextLessons = items.map((lesson, index) => ({ ...lesson, sortOrder: index }));

    setLessons(nextLessons);
    await apiClient("/api/lessons/reorder", {
      method: "PATCH",
      body: JSON.stringify(nextLessons.map((lesson) => ({ id: lesson.id, sortOrder: lesson.sortOrder }))),
    });
    onUpdate();
  };

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    const title = newLessonTitle.trim();
    if (!title) return;

    setError(null);
    setIsCreating(true);
    const response = await apiClient("/api/lessons", {
      method: "POST",
      body: JSON.stringify({ title, stageId }),
    });
    setIsCreating(false);

    if (response.error) {
      setError(response.error);
      return;
    }

    setNewLessonTitle("");
    onUpdate();
  };

  const handleDelete = async (id: string) => {
    if (pendingDeleteId !== id) {
      setPendingDeleteId(id);
      return;
    }

    setError(null);
    const response = await apiClient(`/api/lessons/${id}`, { method: "DELETE" });
    if (response.error) {
      setError(response.error);
      return;
    }

    setPendingDeleteId(null);
    onUpdate();
  };

  return (
    <div className="mt-2 text-sm" dir="rtl">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-xs font-semibold text-muted-foreground">الدروس</h4>
      </div>

      <form onSubmit={handleAdd} className="mb-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={newLessonTitle}
          onChange={(event) => setNewLessonTitle(event.target.value)}
          maxLength={200}
          className="min-w-0 flex-1 rounded border border-border bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="اسم الدرس الجديد"
        />
        <button
          type="submit"
          disabled={isCreating || !newLessonTitle.trim()}
          className="inline-flex cursor-pointer items-center justify-center gap-1 rounded bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
        >
          <Plus className="h-3 w-3" />
          إضافة درس
        </button>
      </form>

      {error && <div className="mb-2 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">{error}</div>}

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId={`lessons-${stageId}`}>
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-1">
              {lessons.map((lesson, index) => (
                <Draggable key={lesson.id} draggableId={lesson.id} index={index}>
                  {(dragProvided, snapshot) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      className={`flex items-center gap-2 rounded border border-border bg-white p-2 ${snapshot.isDragging ? "shadow" : ""}`}
                    >
                      <div
                        {...dragProvided.dragHandleProps}
                        className="cursor-grab text-muted-foreground hover:text-foreground"
                      >
                        <GripVertical className="h-3 w-3" />
                      </div>
                      <div className="flex-1 text-xs">{lesson.title}</div>
                      {pendingDeleteId === lesson.id && (
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(null)}
                          className="cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          aria-label="إلغاء الحذف"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleDelete(lesson.id)}
                        className="cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        aria-label={pendingDeleteId === lesson.id ? "تأكيد حذف الدرس" : "حذف الدرس"}
                      >
                        {pendingDeleteId === lesson.id ? (
                          <span className="px-1 text-xs font-semibold">تأكيد</span>
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
              {lessons.length === 0 && (
                <p className="py-2 text-center text-xs italic text-muted-foreground">لا توجد دروس بعد</p>
              )}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}
