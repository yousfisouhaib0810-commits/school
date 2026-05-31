"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { Plus, GripVertical, Trash2, Edit } from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { SubjectDialog } from "./SubjectDialog";
import { StagesManager } from "./StagesManager";

export type Lesson = { id: string; title: string; description?: string | null; sortOrder: number; stageId: string };
export type Stage = { id: string; title: string; sortOrder: number; subjectId: string; lessons: Lesson[] };
export type Subject = { id: string; title: string; color: string; sortOrder: number; stages: Stage[] };

export function SubjectsManager() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const token = useAuthStore((s) => s.accessToken) ?? undefined;

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchSubjects = async () => {
    if (!token) return;
    setLoading(true);
    const res = await apiClient<Subject[]>("/api/subjects", { token, parse: (v) => v as Subject[] });
    if (res.data) setSubjects(res.data);
    setLoading(false);
  };

  useEffect(() => {
    // Avoid triggering React state update synchronously during render phase
    setTimeout(() => {
      fetchSubjects();
    }, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    
    const items = Array.from(subjects);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    // Update local state first (Optimistic update)
    const newSubjects = items.map((sub, idx) => ({ ...sub, sortOrder: idx }));
    setSubjects(newSubjects);

    // Sync to backend
    await apiClient("/api/subjects/reorder", {
      method: "PATCH",
      token,
      body: JSON.stringify(
        newSubjects.map(s => ({ id: s.id, sortOrder: s.sortOrder }))
      ),
    });
  };

  const deleteSubject = async (id: string) => {
    if (!confirm("هل أنت متأكد من الحذف؟ سيتم حذف كل المحاور والدروس المرتبطة.")) return;
    setSubjects((prev) => prev.filter((s) => s.id !== id));
    await apiClient(`/api/subjects/${id}`, { method: "DELETE", token });
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">جاري أخذ البيانات...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">إدارة المواد التعليمية</h1>
        <button
          onClick={() => setIsDialogOpen(true)}
          className="bg-primary text-primary-foreground flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          إضافة مادة جديدة
        </button>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="subjects-list">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
              {subjects.map((subject, index) => (
                <Draggable key={subject.id} draggableId={subject.id} index={index}>
                  {(provided, snapshot) => (
                    <div ref={provided.innerRef} {...provided.draggableProps}>
                      <div
                        className={`bg-white border border-border rounded-xl p-4 shadow-sm flex items-center gap-4 transition-shadow ${
                          snapshot.isDragging ? "shadow-lg ring-2 ring-primary/20" : ""
                        }`}
                      >
                        <div {...provided.dragHandleProps} className="text-muted-foreground hover:text-foreground cursor-grab">
                          <GripVertical className="w-5 h-5" />
                        </div>
                        
                        <div className="w-4 h-10 rounded-full" style={{ backgroundColor: subject.color }}></div>
                        
                        <div className="flex-1 font-bold text-lg">{subject.title}</div>
                        
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{subject.stages.length} محور</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button className="p-2 text-muted-foreground hover:text-primary transition-colors cursor-pointer rounded-lg hover:bg-muted">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => deleteSubject(subject.id)}
                            className="p-2 text-muted-foreground hover:text-destructive transition-colors cursor-pointer rounded-lg hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setExpandedId(expandedId === subject.id ? null : subject.id)}
                            className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs hover:bg-primary/20 transition-colors ml-4 cursor-pointer"
                          >
                            {expandedId === subject.id ? "إخفاء" : "إدارة المحاور"}
                          </button>
                        </div>
                      </div>
                      {expandedId === subject.id && (
                        <StagesManager 
                          subjectId={subject.id} 
                          initialStages={subject.stages || []} 
                          onUpdate={fetchSubjects} 
                        />
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

      {isDialogOpen && (
        <SubjectDialog 
          onClose={() => setIsDialogOpen(false)} 
          onSuccess={fetchSubjects}
        />
      )}
    </div>
  );
}