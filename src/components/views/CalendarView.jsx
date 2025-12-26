import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Helper, die spaeter ausgelagert werden koennten
const todayISO = () => new Date().toISOString().split("T")[0];

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "long",
  }).format(date);
};

const statusLabel = (status) => {
  switch (status) {
    case "pending":
      return "Offen";
    case "in-progress":
      return "In Arbeit";
    case "completed":
      return "Erledigt";
    default:
      return status || "Offen";
  }
};

export default function CalendarView({ tasks = [], staff = [], onTaskSelect }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState(null);
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));

  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeStaff = Array.isArray(staff) ? staff : [];

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0=So, 1=Mo
  const startDayOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const days = Array.from({ length: startDayOffset }, () => null);
  for (let i = 1; i <= daysInMonth; i += 1) {
    days.push(new Date(year, month, i));
  }

  const monthName = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(currentMonth);

  const staffColors = new Map(safeStaff.map((s) => [s.id, s.color || "bg-slate-400"]));

  const handleTaskClick = (task) => {
    if (onTaskSelect) {
      onTaskSelect(task);
      return;
    }
    setSelectedTask(task);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Monatskalender</h2>
          <p className="text-slate-500">Reinigungsplan fuer {monthName}</p>
        </div>
        <div className="flex gap-2 bg-white rounded-2xl shadow-sm p-1 border border-slate-200">
          <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-xl text-slate-600">
            <ChevronLeft size={20} />
          </button>
          <span className="px-4 py-2 font-semibold text-slate-700 min-w-[150px] text-center">{monthName}</span>
          <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-xl text-slate-600">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((day) => (
            <div key={day} className="py-3 text-center text-sm font-semibold text-slate-600">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 auto-rows-fr bg-slate-200 gap-[1px]">
          {days.map((date, idx) => {
            if (!date) return <div key={`pad-${idx}`} className="bg-slate-50 min-h-[120px]"></div>;

            const dateStr = date.toISOString().split("T")[0];
            const dayTasks = safeTasks.filter((t) => t.date === dateStr);
            const isToday = todayISO() === dateStr;

            return (
              <div key={idx} className={`bg-white min-h-[120px] p-2 hover:bg-teal-50/30 transition-colors ${isToday ? "bg-teal-50" : ""}`}>
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${isToday ? "bg-teal-600 text-white" : "text-slate-700"}`}>
                    {date.getDate()}
                  </span>
                  {dayTasks.length > 0 && <span className="text-xs text-slate-400">{dayTasks.length} Aufgabe(n)</span>}
                </div>
                <div className="space-y-1">
                  {dayTasks.map((task) => {
                    const assignedIds = Array.isArray(task.assignedTo)
                      ? task.assignedTo
                      : task.assignedTo
                      ? [task.assignedTo]
                      : [];
                    const firstStaffId = assignedIds[0];
                    const isAssigned = assignedIds.length > 0;
                    const staffDot = staffColors.get(firstStaffId) || "bg-slate-400";

                    return (
                      <div
                        key={task.id}
                        onClick={() => handleTaskClick(task)}
                        className={`text-[10px] p-1.5 rounded border-l-4 truncate cursor-pointer shadow-sm hover:brightness-95 transition-all active:scale-95 ${
                          task.status === "completed"
                            ? "bg-green-50 border-green-500 text-green-700 opacity-80"
                            : isAssigned
                            ? "bg-teal-50 border-teal-500 text-teal-900"
                            : "bg-slate-50 border-slate-400 text-slate-500"
                        }`}
                        title={task.apartment}
                      >
                        <span className="inline-flex items-center gap-1">
                          {isAssigned && <span className={`w-2 h-2 rounded-full ${staffDot}`} />}
                          <span className="truncate">{task.apartment}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap gap-4 text-sm text-slate-500 mt-4 px-2">
        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-slate-50 border-l-4 border-slate-400 rounded"></div> Offen</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-white border-l-4 border-teal-500 rounded shadow-sm"></div> Zugewiesen</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-50 border-l-4 border-green-500 rounded"></div> Erledigt</div>
      </div>
      <TaskDetailModal task={selectedTask} staff={safeStaff} onClose={() => setSelectedTask(null)} />
    </div>
  );
}

const TaskDetailModal = ({ task, staff, onClose }) => {
  if (!task) return null;
  const assignedIds = Array.isArray(task.assignedTo)
    ? task.assignedTo
    : task.assignedTo
    ? [task.assignedTo]
    : [];
  const assignedNames = assignedIds
    .map((id) => staff.find((s) => s.id === id)?.name)
    .filter(Boolean);

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800">{task.apartment}</h3>
            <p className="text-sm text-slate-500">{formatDate(task.date)}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">x</button>
        </div>

        <div className="mt-4 space-y-2 text-sm text-slate-700">
          <div><span className="font-semibold">Status:</span> {statusLabel(task.status)}</div>
          <div><span className="font-semibold">Zugewiesen:</span> {assignedNames.length ? assignedNames.join(", ") : "Nicht zugewiesen"}</div>
          {task.guestName && <div><span className="font-semibold">Gast:</span> {task.guestName}</div>}
          {task.notes && <div><span className="font-semibold">Notiz:</span> {task.notes}</div>}
        </div>
      </div>
    </div>
  );
};
