"use client";

import { useCallback, useEffect, useState } from "react";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import { Edit, GripVertical, Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { StagesManager } from "./StagesManager";
import { SubjectDialog } from "./SubjectDialog";

export type Lesson = { id: string; title: string; description?: string | null; sortOrder: number; stageId: string };
export type Stage = { id: string; title: string; sortOrder: number; subjectId: string; lessons: Lesson[] };
export type Subject = { id: string; title: string; color: string; sortOrder: number; stages: Stage[] };

const subjectsResponseSchema = z.array(
  z.object({
    id: z.string().uuid(),
    title: z.string(),
    color: z.string(),
    sortOrder: z.number().int(),
    stages: z.array(
      z.object({
        id: z.string().uuid(),
        title: z.string(),
        sortOrder: z.number().int(),
        subjectId: z.string().uuid(),
        lessons: z.array(
          z.object({
            id: z.string().uuid(),
            title: z.string(),
            description: z.string().nullable().optional(),
            sortOrder: z.number().int(),
            stageId: z.string().uuid(),
          })
        ),
      })
    ),
  })
);

export function SubjectsManager() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const token = useAuthStore((state) => state.accessToken) ?? undefined;

  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    const response = await apiClient<Subject[]>("/api/subjects", {
      token,
      parse: (value: unknown) => subjectsResponseSchema.parse(value),
    });

    if (response.data) {
      setSubjects(response.data);
    }

    setLoading(false);
  }, [token]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchSubjects();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [fetchSubjects]);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(subjects);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    const nextSubjects = items.map((subject, index) => ({ ...subject, sortOrder: index }));

    setSubjects(nextSubjects);
    await apiClient("/api/subjects/reorder", {
      method: "PATCH",
      token,
      body: JSON.stringify(nextSubjects.map((subject) => ({ id: subject.id, sortOrder: subject.sortOrder }))),
    });
  };

  const deleteSubject = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه المادة؟ سيتم إخفاء كل المحاور والدروس المرتبطة بها.")) return;

    setSubjects((current) => current.filter((subject) => subject.id !== id));
    await apiClient(`/api/subjects/${id}`, { method: "DELETE", token });
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">جار تحميل البيانات...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">إدارة المواد التعليمية</h1>
        <button
          type="button"
          onClick={() => setIsDialogOpen(true)}
          className="flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-5 w-5" />
          إضافة مادة جديدة
        </button>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="subjects-list">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
              {subjects.map((subject, index) => (
                <Draggable key={subject.id} draggableId={subject.id} index={index}>
                  {(dragProvided, snapshot) => (
                    <div ref={dragProvided.innerRef} {...dragProvided.draggableProps}>
                      <div
                        className={`flex items-center gap-4 rounded-xl border border-border bg-white p-4 shadow-sm transition-shadow ${
                          snapshot.isDragging ? "shadow-lg ring-2 ring-primary/20" : ""
                        }`}
                      >
                        <div
                          {...dragProvided.dragHandleProps}
                          className="cursor-grab text-muted-foreground hover:text-foreground"
                        >
                          <GripVertical className="h-5 w-5" />
                        </div>

                        <div className="h-10 w-4 rounded-full" style={{ backgroundColor: subject.color }} />
                        <div className="flex-1 text-lg font-bold">{subject.title}</div>
                        <div className="text-sm text-muted-foreground">{subject.stages.length} محور</div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="cursor-pointer rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                            aria-label="تعديل المادة"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSubject(subject.id)}
                            className="cursor-pointer rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            aria-label="حذف المادة"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setExpandedId(expandedId === subject.id ? null : subject.id)}
                            className="mr-4 cursor-pointer rounded-full bg-primary/10 px-3 py-1 text-xs text-primary transition-colors hover:bg-primary/20"
                          >
                            {expandedId === subject.id ? "إخفاء" : "إدارة المحاور"}
                          </button>
                        </div>
                      </div>
                      {expandedId === subject.id && (
                        <StagesManager subjectId={subject.id} initialStages={subject.stages} onUpdate={fetchSubjects} />
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

      {isDialogOpen && <SubjectDialog onClose={() => setIsDialogOpen(false)} onSuccess={fetchSubjects} />}
    </div>
  );
}
