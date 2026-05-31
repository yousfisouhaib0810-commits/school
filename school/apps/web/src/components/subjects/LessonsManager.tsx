"use client";

import { useState } from "react";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
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
  const token = useAuthStore((state) => state.accessToken) ?? undefined;

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(lessons);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    const nextLessons = items.map((lesson, index) => ({ ...lesson, sortOrder: index }));

    setLessons(nextLessons);
    await apiClient("/api/lessons/reorder", {
      method: "PATCH",
      token,
      body: JSON.stringify(nextLessons.map((lesson) => ({ id: lesson.id, sortOrder: lesson.sortOrder }))),
    });
    onUpdate();
  };

  const handleAdd = async () => {
    const title = prompt("اسم الدرس الجديد:");
    if (!title) return;

    await apiClient("/api/lessons", {
      method: "POST",
      token,
      body: JSON.stringify({ title, stageId }),
    });
    onUpdate();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("تأكيد حذف هذا الدرس؟")) return;
    await apiClient(`/api/lessons/${id}`, { method: "DELETE", token });
    onUpdate();
  };

  return (
    <div className="mt-2 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-xs font-semibold text-muted-foreground">الدروس</h4>
        <button
          onClick={handleAdd}
          className="flex cursor-pointer items-center gap-1 rounded bg-primary/10 px-2 py-1 text-[10px] text-primary hover:bg-primary/20"
        >
          <Plus className="h-3 w-3" />
          أضف درس
        </button>
      </div>

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
                      <button
                        onClick={() => handleDelete(lesson.id)}
                        className="cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
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
