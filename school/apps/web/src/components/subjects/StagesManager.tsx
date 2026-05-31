"use client";

import { useState } from "react";
import { Stage } from "./SubjectsManager";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { GripVertical, Trash2, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { LessonsManager } from "./LessonsManager";

export function StagesManager({ 
  subjectId, 
  initialStages, 
  onUpdate 
}: { 
  subjectId: string; 
  initialStages: Stage[]; 
  onUpdate: () => void;
}) {
  const [stages, setStages] = useState(initialStages);
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const token = useAuthStore((s) => s.accessToken) ?? undefined;

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    
    const items = Array.from(stages);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    const newStages = items.map((st, idx) => ({ ...st, sortOrder: idx }));
    setStages(newStages);

    await apiClient("/api/stages/reorder", {
      method: "PATCH",
      token,
      body: JSON.stringify(
        newStages.map(s => ({ id: s.id, sortOrder: s.sortOrder }))
      ),
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
    if (!confirm("تأكيد الحذف؟")) return;
    await apiClient(`/api/stages/${id}`, { method: "DELETE", token });
    onUpdate();
  };

  return (
    <div className="mt-4 mr-8 p-4 bg-muted/30 rounded-xl border border-border">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-sm text-foreground">محاور المادة</h3>
        <button onClick={handleAdd} className="text-xs bg-secondary text-secondary-foreground hover:bg-secondary/80 px-3 py-1 rounded-md flex items-center gap-1 cursor-pointer">
          <Plus className="w-3 h-3" /> أضف محور
        </button>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId={`stages-${subjectId}`}>
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
              {stages.map((stage, index) => (
                <Draggable key={stage.id} draggableId={stage.id} index={index}>
                  {(provided, snapshot) => (
                    <div ref={provided.innerRef} {...provided.draggableProps} className={`bg-white border border-border rounded-lg ${snapshot.isDragging ? "shadow-md" : ""}`}>
                      <div className="flex items-center p-3 gap-3">
                        <div {...provided.dragHandleProps} className="text-muted-foreground hover:text-foreground cursor-grab">
                          <GripVertical className="w-4 h-4" />
                        </div>
                        <div className="flex-1 text-sm font-medium">{stage.title}</div>
                        
                        <div className="flex items-center gap-1 text-muted-foreground mr-auto">
                          <button onClick={() => handleDelete(stage.id)} className="p-1 hover:text-destructive transition-colors cursor-pointer rounded hover:bg-destructive/10">
                            <Trash2 className="w-3 h-3" />
                          </button>
                          <button 
                            onClick={() => setExpandedStage(expandedStage === stage.id ? null : stage.id)}
                            className="p-1 hover:text-primary transition-colors cursor-pointer rounded hover:bg-primary/10 ml-2 bg-muted"
                          >
                            {expandedStage === stage.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      
                      {expandedStage === stage.id && (
                        <div className="p-3 border-t border-border bg-gray-50/50">
                          <LessonsManager stageId={stage.id} initialLessons={stage.lessons || []} onUpdate={onUpdate} />
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
