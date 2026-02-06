import { BuildingWithFloors } from "@docstruc/api";
import { Project, Task } from "./types";
import { colors } from "@docstruc/theme";

export const generateReportHtml = (
  project: Project,
  structure: BuildingWithFloors[],
  tasks: Task[]
) => {
  const dateStr = new Date().toLocaleDateString("de-DE");
  
  // Helper to get tasks for a room
  const getTasksForRoom = (roomId: string) => tasks.filter(t => t.room_id === roomId);

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
        h1 { color: ${colors.primary}; border-bottom: 2px solid ${colors.primary}; padding-bottom: 10px; }
        h2 { background: #eee; padding: 8px; border-radius: 4px; margin-top: 20px; }
        h3 { margin-top: 15px; border-bottom: 1px solid #ddd; }
        h4 { margin-top: 10px; color: #666; }
        .meta { margin-bottom: 30px; }
        .meta-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
        .task-list { width: 100%; border-collapse: collapse; margin-top: 10px; }
        .task-list th { text-align: left; background: #f9f9f9; padding: 8px; border: 1px solid #ddd; }
        .task-list td { padding: 8px; border: 1px solid #ddd; vertical-align: top; }
        .status { font-weight: bold; background: #eee; padding: 2px 6px; borderRadius: 4px; font-size: 0.8em; }
        .status-open { color: red; }
        .status-done { color: green; }
        .status-in_progress { color: orange; }
        .img-thumb { width: 80px; height: 80px; object-fit: cover; border: 1px solid #ccc; }
        .no-tasks { color: #888; font-style: italic; font-size: 0.9em; }
      </style>
    </head>
    <body>
      <h1>Projektbericht: ${project.name}</h1>
      
      <div class="meta">
        <div class="meta-row"><strong>Adresse:</strong> <span>${project.address || '-'}</span></div>
        <div class="meta-row"><strong>Status:</strong> <span>${project.status.toUpperCase()}</span></div>
        <div class="meta-row"><strong>Datum:</strong> <span>${dateStr}</span></div>
      </div>
  `;

  if (structure.length === 0) {
    html += `<p>Keine Gebäudestruktur vorhanden.</p>`;
  }

  structure.forEach(building => {
    html += `<h2>🏢 ${building.name}</h2>`;
    
    building.floors.forEach(floor => {
      html += `<h3>📑 ${floor.name} (Ebene: ${floor.level_index})</h3>`;
      
      floor.rooms.forEach(room => {
        const roomTasks = getTasksForRoom(room.id);
        
        html += `<h4>🚪 ${room.name}</h4>`;
        
        if (roomTasks.length > 0) {
          html += `
            <table class="task-list">
              <thead>
                <tr>
                  <th style="width: 30%">Aufgabe</th>
                  <th style="width: 30%">Beschreibung</th>
                  <th style="width: 15%">Status</th>
                  <th style="width: 15%">Fällig</th>
                  <th style="width: 10%">Bild</th>
                </tr>
              </thead>
              <tbody>
          `;
          
          roomTasks.forEach(task => {
            const img = task.images && task.images.length > 0 
              ? `<img src="${task.images[0]}" class="img-thumb" />` 
              : '-';
            
            const dueDate = task.due_date ? new Date(task.due_date).toLocaleDateString() : '-';
            
            html += `
              <tr>
                <td><strong>${task.title}</strong></td>
                <td>${task.description || ''}</td>
                <td><span class="status status-${task.status}">${task.status.toUpperCase()}</span></td>
                <td>${dueDate}</td>
                <td>${img}</td>
              </tr>
            `;
          });
          
          html += `</tbody></table>`;
        } else {
          html += `<div class="no-tasks">Keine Aufgaben in diesem Raum.</div>`;
        }
      });
    });
  });

  html += `
    </body>
    </html>
  `;

  return html;
};
