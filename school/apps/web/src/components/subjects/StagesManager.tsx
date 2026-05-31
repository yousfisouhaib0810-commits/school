"use client";

import { useState } from "react";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import type { Stage } from "./SubjectsManager";
import { LessonsManager } from "./LessonsManager";

export function StagesManager({
  subjectId,
  initialStages,
  onUpdate,
}: {
  subjectId: string;
  initialStages: Stage[];
  onUpdate: () => void;
}) {
  const [stages, setStages] = useState(initialStages);
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const token = useAuthStore((state) => state.accessToken) ?? undefined;

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(stages);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    const nextStages = items.map((stage, index) => ({ ...stage, sortOrder: index }));

    setStages(nextStages);
    await apiClient("/api/stages/reorder", {
      method: "PATCH",
      token,
      body: JSON.stringify(nextStages.map((stage) => ({ id: stage.id, sortOrder: stage.sortOrder }))),
    });
    onUpdate();
  };

  const handleAdd = async () => {
    const title = prompt("اسم المحور الجديد:");
    if (!title) return;

    await apiClient("/api/stages", {
      method: "POST",
      token,
      body: JSON.stringify({ title, subjectId }),
    });
    onUpdate();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("تأكيد حذف هذا المحور؟ سيتم إخفاء الدروس المرتبطة به.")) return;
    await apiClient(`/api/stages/${id}`, { method: "DELETE", token });
    onUpdate();
  };

  return (
    <div className="mr-8 mt-4 rounded-xl border border-border bg-muted/30 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">محاور المادة</h3>
        <button
          onClick={handleAdd}
          className="flex cursor-pointer items-center gap-1 rounded-md bg-secondary px-3 py-1 text-xs text-secondary-foreground hover:bg-secondary/80"
        >
          <Plus className="h-3 w-3" />
          أضف محور
        </button>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId={`stages-${subjectId}`}>
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
              {stages.map((stage, index) => (
                <Draggable key={stage.id} draggableId={stage.id} index={index}>
                  {(dragProvided, snapshot) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      className={`rounded-lg border border-border bg-white ${snapshot.isDragging ? "shadow-md" : ""}`}
                    >
                      <div className="flex items-center gap-3 p-3">
                        <div
                          {...dragProvided.dragHandleProps}
                          className="cursor-grab text-muted-foreground hover:text-foreground"
                        >
                          <GripVertical className="h-4 w-4" />
                        </div>
                        <div className="flex-1 text-sm font-medium">{stage.title}</div>

                        <div className="mr-auto flex items-center gap-1 text-muted-foreground">
                          <button
                            onClick={() => handleDelete(stage.id)}
                            className="cursor-pointer rounded p-1 transition-colors hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => setExpandedStage(expandedStage === stage.id ? null : stage.id)}
                            className="mr-2 cursor-pointer rounded bg-muted p-1 transition-colors hover:bg-primary/10 hover:text-primary"
                          >
                            {expandedStage === stage.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      {expandedStage === stage.id && (
                        <div className="border-t border-border bg-gray-50/50 p-3">
                          <LessonsManager stageId={stage.id} initialLessons={stage.lessons} onUpdate={onUpdate} />
                        </div>
                      )}
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}
