"use client";

import { useState } from "react";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2, X } from "lucide-react";
import { apiClient } from "@/lib/api";
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
  const [newStageTitle, setNewStageTitle] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(stages);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    const nextStages = items.map((stage, index) => ({ ...stage, sortOrder: index }));

    setStages(nextStages);
    await apiClient("/api/stages/reorder", {
      method: "PATCH",
      body: JSON.stringify(nextStages.map((stage) => ({ id: stage.id, sortOrder: stage.sortOrder }))),
    });
    onUpdate();
  };

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    const title = newStageTitle.trim();
    if (!title) return;

    setError(null);
    setIsCreating(true);
    const response = await apiClient("/api/stages", {
      method: "POST",
      body: JSON.stringify({ title, subjectId }),
    });
    setIsCreating(false);

    if (response.error) {
      setError(response.error);
      return;
    }

    setNewStageTitle("");
    onUpdate();
  };

  const handleDelete = async (id: string) => {
    if (pendingDeleteId !== id) {
      setPendingDeleteId(id);
      return;
    }

    setError(null);
    const response = await apiClient(`/api/stages/${id}`, { method: "DELETE" });
    if (response.error) {
      setError(response.error);
      return;
    }

    setPendingDeleteId(null);
    onUpdate();
  };

  return (
    <div className="mr-8 mt-4 rounded-xl border border-border bg-muted/30 p-4" dir="rtl">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h3 className="text-sm font-bold text-foreground">محاور المادة</h3>
      </div>

      <form onSubmit={handleAdd} className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={newStageTitle}
          onChange={(event) => setNewStageTitle(event.target.value)}
          maxLength={200}
          className="min-w-0 flex-1 rounded-md border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="اسم المحور الجديد"
        />
        <button
          type="submit"
          disabled={isCreating || !newStageTitle.trim()}
          className="inline-flex cursor-pointer items-center justify-center gap-1 rounded-md bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
        >
          <Plus className="h-3 w-3" />
          إضافة محور
        </button>
      </form>

      {error && <div className="mb-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

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
                          {pendingDeleteId === stage.id && (
                            <button
                              type="button"
                              onClick={() => setPendingDeleteId(null)}
                              className="cursor-pointer rounded p-1 transition-colors hover:bg-muted hover:text-foreground"
                              aria-label="إلغاء الحذف"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void handleDelete(stage.id)}
                            className="cursor-pointer rounded p-1 transition-colors hover:bg-destructive/10 hover:text-destructive"
                            aria-label={pendingDeleteId === stage.id ? "تأكيد حذف المحور" : "حذف المحور"}
                          >
                            {pendingDeleteId === stage.id ? (
                              <span className="px-1 text-xs font-semibold">تأكيد</span>
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setExpandedStage(expandedStage === stage.id ? null : stage.id)}
                            className="mr-2 cursor-pointer rounded bg-muted p-1 transition-colors hover:bg-primary/10 hover:text-primary"
                            aria-label="إدارة الدروس"
                          >
                            {expandedStage === stage.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      {expandedStage === stage.id && (
                        <div className="border-t border-border bg-gray-50/50 p-3">
                          <LessonsManager
                            key={`${stage.id}-${stage.lessons.map((lesson) => `${lesson.id}:${lesson.sortOrder}`).join("|")}`}
                            stageId={stage.id}
                            initialLessons={stage.lessons}
                            onUpdate={onUpdate}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
              {stages.length === 0 && (
                <p className="py-3 text-center text-xs italic text-muted-foreground">لا توجد محاور بعد</p>
              )}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}
