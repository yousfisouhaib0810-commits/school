"use client";

import { useState } from "react";
import { Lesson } from "./SubjectsManager";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { GripVertical, Trash2, Plus } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

export function LessonsManager({ 
  stageId, 
  initialLessons, 
  onUpdate 
}: { 
  stageId: string; 
  initialLessons: Lesson[]; 
  onUpdate: () => void;
}) {
  const [lessons, setLessons] = useState(initialLessons);
  const token = useAuthStore((s) => s.accessToken) ?? undefined;

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    
    const items = Array.from(lessons);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    const newLessons = items.map((ls, idx) => ({ ...ls, sortOrder: idx }));
    setLessons(newLessons);

    await apiClient("/api/lessons/reorder", {
      method: "PATCH",
      token,
      body: JSON.stringify(
        newLessons.map(l => ({ id: l.id, sortOrder: l.sortOrder }))
      ),
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
    if (!confirm("تأكيد الحذف؟")) return;
    await apiClient(`/api/lessons/${id}`, { method: "DELETE", token });
    onUpdate();
  };

  return (
    <div className="mt-2 text-sm">
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-semibold text-xs text-muted-foreground">الدروس</h4>
        <button onClick={handleAdd} className="text-[10px] bg-primary/10 text-primary hover:bg-primary/20 px-2 py-1 rounded flex items-center gap-1 cursor-pointer">
          <Plus className="w-3 h-3" /> أضف درس
        </button>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId={`lessons-${stageId}`}>
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-1">
              {lessons.map((lesson, index) => (
                <Draggable key={lesson.id} draggableId={lesson.id} index={index}>
                  {(provided, snapshot) => (
                    <div ref={provided.innerRef} {...provided.draggableProps} className={`bg-white border border-border rounded p-2 flex items-center gap-2 ${snapshot.isDragging ? "shadow" : ""}`}>
                      <div {...provided.dragHandleProps} className="text-muted-foreground hover:text-foreground cursor-grab">
                        <GripVertical className="w-3 h-3" />
                      </div>
                      <div className="flex-1 text-xs">{lesson.title}</div>
                      <button onClick={() => handleDelete(lesson.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors cursor-pointer rounded hover:bg-destructive/10">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
              {lessons.length === 0 && (
                <p className="text-xs text-muted-foreground italic text-center py-2">لا توجد دروس بعد</p>
              )}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}